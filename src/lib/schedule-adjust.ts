import { callChat, normalizeDate, resolveTextModel, AiParseError } from "./siliconflow";
import type {
  CalendarImportUsage,
  CalendarEventStatus,
  ScheduleAdjustmentChange,
  ScheduleAdjustmentConfidence,
  ScheduleAdjustmentDraft,
  WorkScheduleItemType,
} from "@/types";

// M13 AI 自然语言调整排期：文字模型 + 项目排期上下文 → 可确认的变更草稿。
// 只负责生成草稿与规范化，绝不直接入库——写入由 /api/calendar-adjustments/apply 在用户确认后完成。

const MAX_CHANGES = 100;

function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 单条排期上下文（只包含必要字段，不给全量数据）。 */
export interface ScheduleAdjustmentContextItem {
  id: string;
  title: string;
  type: WorkScheduleItemType;
  startDate: string;
  endDate: string;
  status: CalendarEventStatus;
}

export interface GenerateAdjustmentDraftInput {
  projectId: string;
  projectName: string;
  instruction: string;
  /** 未来排期（14-30 天），按 startDate 升序。 */
  futureItems: ScheduleAdjustmentContextItem[];
  /** 最近 7 天排期（含今天及之前），按 startDate 升序。 */
  recentItems: ScheduleAdjustmentContextItem[];
}

export interface GenerateAdjustmentDraftResult {
  draft: ScheduleAdjustmentDraft;
  usage: CalendarImportUsage;
}

function buildSystemPrompt(now: Date): string {
  const currentDate = fmtDate(now);
  return `你是排期调整助手。用户会用一句话描述某个项目的排期变更需求，你需要根据提供的排期上下文，生成一份可确认的变更草稿。
只输出 JSON，不输出解释。
日期必须输出 YYYY-MM-DD。
当前日期是 ${currentDate}。

原则：
1. 不直接修改任何数据，只生成变更草稿，由用户确认后才会执行。
2. 只基于提供的排期上下文判断，不要编造不存在的排期。
3. 今天之前的排期（历史排期）默认不修改，除非用户明确要求修改历史。
4. 只调整当前项目（projectId 由上下文给定），不要涉及其它项目。
5. 用户意图模糊、无法判断调整哪些排期时，输出 confidence=low、changes 为空数组，并在 warnings 里说明需要补充什么信息。
6. 每个变更都要写 reason（为什么这样改）。
7. create 用于新增一条排期；update 用于修改已有排期（before 是原值，after 是新值）；不改动但需要说明的条目用 noop。
8. 不要删除任何排期。

输出必须符合以下 JSON 结构（ScheduleAdjustmentDraft）：
{
  "summary": "一句话概括本次调整",
  "confidence": "high|medium|low",
  "warnings": ["说明哪些内容不确定或需要用户确认"],
  "changes": [
    { "type": "create", "title": "新增节点标题", "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD", "reason": "为什么新增" },
    { "type": "update", "itemId": "排期 id", "before": { "title": "原标题", "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD" }, "after": { "title": "新标题", "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD" }, "reason": "为什么调整" },
    { "type": "noop", "itemId": "排期 id（可省略）", "reason": "说明为什么不改" }
  ]
}`;
}

function formatItems(items: ScheduleAdjustmentContextItem[]): string {
  if (items.length === 0) return "（无）";
  const lines = items.map((it) => {
    const span = it.type === "node" ? `${it.startDate}` : `${it.startDate} ~ ${it.endDate}`;
    return `- [${it.id}] ${span}（${it.type}，状态：${it.status}）：${it.title}`;
  });
  return lines.join("\n");
}

function buildUserPrompt(input: GenerateAdjustmentDraftInput): string {
  return `项目名：${input.projectName}
项目 id：${input.projectId}
用户调整说明：${input.instruction}

【未来排期（今天起未来 30 天内）】
${formatItems(input.futureItems)}

【最近 7 天排期（含今天及之前）】
${formatItems(input.recentItems)}

请根据以上上下文生成排期调整草稿。`;
}

function pickConfidence(v: unknown): ScheduleAdjustmentConfidence {
  if (v === "high" || v === "low") return v;
  return "medium";
}

function pickDate(v: unknown): string | null {
  return normalizeDate(v);
}

/** 规范化一条 change；非法则返回 null。projectId 强制使用当前项目，防止 AI 指向其它项目。 */
function normalizeChange(raw: unknown, projectId: string, warnings: string[]): ScheduleAdjustmentChange | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const type = r.type;
  const reason = typeof r.reason === "string" && r.reason.trim() ? r.reason.trim() : "";

  if (type === "create") {
    const title = typeof r.title === "string" ? r.title.trim() : "";
    const start = pickDate(r.startDate);
    if (!title || !start) {
      warnings.push("存在缺少标题或日期的「新增」建议，已忽略");
      return null;
    }
    const end = pickDate(r.endDate) ?? start;
    if (end < start) {
      warnings.push(`「${title}」新增建议结束日期早于开始日期，已交换`);
      return { type: "create", projectId, title, startDate: end, endDate: start, reason: reason || "AI 建议新增" };
    }
    return { type: "create", projectId, title, startDate: start, endDate: end, reason: reason || "AI 建议新增" };
  }

  if (type === "update") {
    const itemId = typeof r.itemId === "string" && r.itemId.trim() ? r.itemId.trim() : "";
    if (!itemId) {
      warnings.push("存在缺少排期 id 的「修改」建议，已忽略");
      return null;
    }
    const before = (r.before ?? {}) as Record<string, unknown>;
    const after = (r.after ?? {}) as Record<string, unknown>;
    const beforeTitle = typeof before.title === "string" ? before.title.trim() : "";
    const afterTitle = typeof after.title === "string" ? after.title.trim() : "";
    const beforeStart = pickDate(before.startDate);
    const afterStart = pickDate(after.startDate);
    if (!afterTitle || !afterStart) {
      warnings.push("存在缺少修改后标题或日期的「修改」建议，已忽略");
      return null;
    }
    const beforeEnd = pickDate(before.endDate) ?? beforeStart ?? afterStart;
    const afterEnd = pickDate(after.endDate) ?? afterStart;
    if (afterEnd < afterStart) {
      warnings.push(`「${afterTitle}」修改建议结束日期早于开始日期，已交换`);
      return {
        type: "update",
        itemId,
        before: { title: beforeTitle || afterTitle, startDate: beforeStart ?? afterStart, endDate: beforeEnd },
        after: { title: afterTitle, startDate: afterEnd, endDate: afterStart },
        reason: reason || "AI 建议调整",
      };
    }
    return {
      type: "update",
      itemId,
      before: { title: beforeTitle || afterTitle, startDate: beforeStart ?? afterStart, endDate: beforeEnd },
      after: { title: afterTitle, startDate: afterStart, endDate: afterEnd },
      reason: reason || "AI 建议调整",
    };
  }

  if (type === "noop") {
    const itemId = typeof r.itemId === "string" && r.itemId.trim() ? r.itemId.trim() : undefined;
    return { type: "noop", itemId, reason: reason || "该项保持不变" };
  }

  return null;
}

/** 把 AI 原始输出规范化为 ScheduleAdjustmentDraft；非法项进 warnings 并丢弃。 */
export function normalizeAdjustDraft(raw: unknown, projectId: string): ScheduleAdjustmentDraft {
  const warnings: string[] = [];
  const changes: ScheduleAdjustmentChange[] = [];

  if (!raw || typeof raw !== "object") {
    throw new AiParseError("INVALID_DRAFT", "AI 未返回有效草稿");
  }
  const obj = raw as Record<string, unknown>;

  const summary = typeof obj.summary === "string" && obj.summary.trim() ? obj.summary.trim() : "";
  const confidence = pickConfidence(obj.confidence);

  const rawChanges = Array.isArray(obj.changes) ? obj.changes : [];
  for (const c of rawChanges.slice(0, MAX_CHANGES)) {
    const normalized = normalizeChange(c, projectId, warnings);
    if (normalized) changes.push(normalized);
  }

  if (Array.isArray(obj.warnings)) {
    for (const w of obj.warnings) {
      if (typeof w === "string" && w.trim()) warnings.push(w.trim());
    }
  }

  return { summary, confidence, warnings, changes };
}

/** 调文字 AI 生成排期调整草稿。AI 失败/超时抛 AiParseError。 */
export async function generateAdjustmentDraft(
  input: GenerateAdjustmentDraftInput
): Promise<GenerateAdjustmentDraftResult> {
  const now = new Date();
  const messages = [
    { role: "system", content: buildSystemPrompt(now) },
    { role: "user", content: buildUserPrompt(input) },
  ];
  const model = resolveTextModel("adjust");
  const { raw, usage } = await callChat(messages, model);
  const draft = normalizeAdjustDraft(raw, input.projectId);
  return { draft, usage };
}
