import { isValidDateString } from "./calendar";
import type {
  CalendarImportDraft,
  CalendarImportDraftItem,
  CalendarImportDraftProject,
  CalendarImportUsage,
} from "@/types";

// M13 AI 排期导入：调用硅基流动 /chat/completions，把图片/Excel 文本识别成结构化草稿。
// 只负责识别与规范化，绝不直接入库——写入由 /api/calendar-imports/confirm 在用户确认后完成。

const API_URL = "https://api.siliconflow.cn/v1/chat/completions";
const MAX_PROJECTS = 50;
const MAX_ITEMS = 200;

export class AiParseError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

const SYSTEM_PROMPT = `你是排期表识别助手。请从用户提供的图片或表格文本中提取项目排期。
只输出 JSON，不输出解释。
日期必须输出 YYYY-MM-DD。
如果某个任务跨多天，输出 startDate 和 endDate；如果只发生一天，startDate 和 endDate 相同。
不要编造日期。
不确定时写入 warnings，并降低 confidence。
输出必须符合以下 JSON 结构（CalendarImportDraft）：
{
  "projects": [{ "tempId": "p1", "name": "项目名", "colorKey": "blue|red|green|purple|gray（可省略）" }],
  "items": [{
    "tempId": "i1",
    "projectTempId": "p1",
    "title": "阶段/节点标题",
    "startDate": "YYYY-MM-DD",
    "endDate": "YYYY-MM-DD",
    "note": "备注（可省略）",
    "confidence": 0.9,
    "sourceRef": "来源坐标（可省略）"
  }],
  "warnings": ["说明哪些内容不确定"]
}`;

/** 宽松日期归一化 → YYYY-MM-DD；无法解析返回 null。 */
export function normalizeDate(s: unknown): string | null {
  if (typeof s !== "string") return null;
  const t = s.trim();
  if (isValidDateString(t)) return t;
  // YYYY/M/D | YYYY.M.D | YYYY年M月D日 | YYYYMMDD
  let m = t.match(/^(\d{4})[./年](\d{1,2})[./月](\d{1,2})日?$/);
  if (m) return pad(`${m[1]}-${m[2]}-${m[3]}`);
  m = t.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return pad(`${m[1]}-${m[2]}-${m[3]}`);
  // M/D/YYYY（美式，常见于影视排期）→ MM/DD/YYYY
  m = t.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/);
  if (m) return pad(`${m[3]}-${m[1]}-${m[2]}`);
  return null;
}

function pad(s: string): string | null {
  const v = normalizeDate(
    s.replace(/^(\d{4})-(\d{1,2})-(\d{1,2})$/, (_, y, mo, d) => `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`)
  );
  return v && isValidDateString(v) ? v : null;
}

function toNum(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function cleanId(s: unknown): string | undefined {
  return typeof s === "string" && s.trim() ? s.trim() : undefined;
}

/** 把 AI 原始输出规范化为统一草稿；非法项进 warnings 并丢弃。 */
export function normalizeDraft(raw: unknown): CalendarImportDraft {
  const warnings: string[] = [];
  const projects: CalendarImportDraftProject[] = [];
  const items: CalendarImportDraftItem[] = [];

  if (!raw || typeof raw !== "object") {
    throw new AiParseError("INVALID_DRAFT", "AI 未返回有效草稿");
  }
  const obj = raw as Record<string, unknown>;

  // 项目
  const rawProjects = Array.isArray(obj.projects) ? obj.projects : [];
  for (const p of rawProjects.slice(0, MAX_PROJECTS)) {
    if (!p || typeof p !== "object") continue;
    const pr = p as Record<string, unknown>;
    const name = typeof pr.name === "string" ? pr.name.trim() : "";
    if (!name) continue;
    const colorKey = ["blue", "red", "green", "purple", "gray"].includes(String(pr.colorKey ?? ""))
      ? (String(pr.colorKey) as CalendarImportDraftProject["colorKey"])
      : undefined;
    projects.push({
      tempId: cleanId(pr.tempId) ?? `p${projects.length + 1}`,
      name,
      colorKey,
    });
  }

  // 条目
  const rawItems = Array.isArray(obj.items) ? obj.items : [];
  const projectIds = new Set(projects.map((p) => p.tempId));
  for (const it of rawItems.slice(0, MAX_ITEMS)) {
    if (!it || typeof it !== "object") continue;
    const r = it as Record<string, unknown>;
    const title = typeof r.title === "string" ? r.title.trim() : "";
    let start = normalizeDate(r.startDate);
    let end = normalizeDate(r.endDate);
    if (!title) continue;
    if (!start) {
      warnings.push(`「${title}」缺少可识别的开始日期，已跳过`);
      continue;
    }
    if (!end) {
      end = start;
      warnings.push(`「${title}」缺少结束日期，按单日处理`);
    } else if (end < start) {
      warnings.push(`「${title}」结束日期早于开始日期，已交换`);
      [start, end] = [end, start];
    }

    // 项目归属：优先命中项目 tempId；否则归入第一个项目，无项目则兜底新建
    let projectTempId = cleanId(r.projectTempId) ?? "";
    if (!projectIds.has(projectTempId)) {
      if (projects.length === 0) {
        projects.push({ tempId: "p1", name: "导入项目" });
        projectIds.add("p1");
        projectTempId = "p1";
      } else {
        projectTempId = projects[0].tempId;
        warnings.push(`「${title}」未识别到所属项目，已归入「${projects[0].name}」`);
      }
    }

    const confidence = toNum(r.confidence);
    items.push({
      tempId: cleanId(r.tempId) ?? `i${items.length + 1}`,
      projectTempId,
      title,
      startDate: start,
      endDate: end,
      note: typeof r.note === "string" && r.note.trim() ? r.note.trim() : undefined,
      confidence: confidence !== undefined && confidence >= 0 && confidence <= 1 ? confidence : undefined,
      sourceRef: typeof r.sourceRef === "string" && r.sourceRef.trim() ? r.sourceRef.trim() : undefined,
    });
  }

  if (Array.isArray(obj.warnings)) {
    for (const w of obj.warnings) {
      if (typeof w === "string" && w.trim()) warnings.push(w.trim());
    }
  }

  return { projects, items, warnings };
}

interface ChatMessageContent {
  role: string;
  content: unknown;
}

/** 调 /chat/completions，返回 JSON 草稿原始对象 + usage。 */
async function callChat(
  messages: ChatMessageContent[]
): Promise<{ raw: unknown; usage: CalendarImportUsage }> {
  const apiKey = process.env.SILICONFLOW_API_KEY;
  if (!apiKey) {
    throw new AiParseError("AI_NOT_CONFIGURED", "AI 未配置（缺少 SILICONFLOW_API_KEY）");
  }
  const model = process.env.SILICONFLOW_MODEL || "Qwen/Qwen3.5-9B";
  const startedAt = Date.now();

  let res: Response;
  try {
    res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.1,
        max_tokens: 4096,
        response_format: { type: "json_object" },
        // Qwen3 系为推理模型：默认先输出 reasoning_content 且可能耗尽 token 无最终答案，
        // 关闭思考才能直接返回 JSON 正文。
        ...(/Qwen3/i.test(model) ? { enable_thinking: false } : {}),
      }),
    });
  } catch (e) {
    throw new AiParseError("AI_NETWORK_ERROR", "AI 服务请求失败");
  }

  const durationMs = Date.now() - startedAt;

  let body: Record<string, unknown>;
  try {
    body = await res.json();
  } catch {
    throw new AiParseError("AI_HTTP_ERROR", "AI 服务返回无效响应");
  }

  if (!res.ok) {
    throw new AiParseError("AI_HTTP_ERROR", `AI 服务错误（HTTP ${res.status}）`);
  }

  const content = (body.choices as { message?: { content?: unknown } }[])?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new AiParseError("AI_EMPTY", "AI 未返回内容");
  }

  // 容忍代码块包裹：```json ... ```
  let cleaned = content.trim();
  const fence = cleaned.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fence) cleaned = fence[1].trim();

  let raw: unknown;
  try {
    raw = JSON.parse(cleaned);
  } catch {
    throw new AiParseError("AI_INVALID_JSON", "AI 返回的不是有效 JSON");
  }

  const usage = body.usage as { prompt_tokens?: number; completion_tokens?: number };
  return {
    raw,
    usage: {
      model,
      promptTokens: usage?.prompt_tokens ?? 0,
      completionTokens: usage?.completion_tokens ?? 0,
      durationMs,
    },
  };
}

export interface ParseScheduleFileInput {
  kind: "image" | "excel";
  fileBuffer: Buffer;
  mimeType?: string;
  filename?: string;
  /** excel 模式：excelToText 的结构化文本。 */
  excelText?: string;
}

export interface ParseScheduleFileResult {
  draft: CalendarImportDraft;
  usage: CalendarImportUsage;
}

/** 识别图片/Excel 排期 → 规范化草稿 + usage。 */
export async function parseScheduleFile(input: ParseScheduleFileInput): Promise<ParseScheduleFileResult> {
  const messages: ChatMessageContent[] = [{ role: "system", content: SYSTEM_PROMPT }];

  if (input.kind === "image") {
    const base64 = input.fileBuffer.toString("base64");
    const mime = input.mimeType || "image/png";
    messages.push({
      role: "user",
      content: [
        { type: "image_url", image_url: { url: `data:${mime};base64,${base64}` } },
        { type: "text", text: "请识别图片中的项目排期，输出 CalendarImportDraft JSON。" },
      ],
    });
  } else {
    messages.push({
      role: "user",
      content: `请识别以下表格文本中的项目排期，输出 CalendarImportDraft JSON。\n\n${input.excelText ?? ""}`,
    });
  }

  const { raw, usage } = await callChat(messages);
  const draft = normalizeDraft(raw);
  return { draft, usage };
}
