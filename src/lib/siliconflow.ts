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

function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// 当前日期/年份动态注入（2.2 年份上下文）：避免 AI 猜测往年年份。
function buildSystemPrompt(now: Date): string {
  const currentYear = now.getFullYear();
  const currentDate = fmtDate(now);
  return `你是排期表识别助手。请从用户提供的图片或表格文本中提取项目排期。
只输出 JSON，不输出解释。
日期必须输出 YYYY-MM-DD。
当前日期是 ${currentDate}，当前年份是 ${currentYear} 年。
如果排期表中只有月份和日期、没有完整年份，默认使用 ${currentYear} 年。
不要猜测为 ${currentYear - 1} 年或其他往年年份，除非表格中明确写出该年份。
不确定年份时，使用 ${currentYear} 年，并在 warnings 中说明「年份按当前年份补全」。
如果某个任务跨多天，输出 startDate 和 endDate；如果只发生一天，startDate 和 endDate 相同。
不要编造日期。
项目名识别优先级：1) 表格/图片标题中的项目名；2) Excel 的 Sheet 名；3) 文件名。
如果识别不到项目名，输出 name 为空字符串 ""，并在 warnings 中说明「未识别到项目名」。
不要凭空捏造项目名。
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
}

/** 宽松日期归一化 → YYYY-MM-DD；无法解析返回 null。currentYear 用于「只有月/日、无年份」时补全年份。 */
export function normalizeDate(s: unknown, currentYear?: number): string | null {
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
  // M/D 或 M月D日（无年份，常见排期表）→ 当前年补全（2.2）
  m = t.match(/^(\d{1,2})[/月.](\d{1,2})日?$/);
  if (m) return pad(`${currentYear ?? new Date().getFullYear()}-${m[1]}-${m[2]}`);
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
export function normalizeDraft(raw: unknown, currentYear = new Date().getFullYear()): CalendarImportDraft {
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
    let start = normalizeDate(r.startDate, currentYear);
    let end = normalizeDate(r.endDate, currentYear);
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

    // 2.2 异常年份：明显偏离当前年时给出提示，供前端批量修正
    const y = Number(start.slice(0, 4));
    if (Number.isFinite(y) && (y < currentYear - 1 || y > currentYear + 1)) {
      warnings.push(`「${title}」年份异常（${y} 年），请在预览中确认是否应为 ${currentYear} 年`);
    }

    // 项目归属：优先命中项目 tempId；否则归入第一个项目，无项目则兜底空名项目（2.5 由用户在预览中补充项目名）
    let projectTempId = cleanId(r.projectTempId) ?? "";
    if (!projectIds.has(projectTempId)) {
      if (projects.length === 0) {
        projects.push({ tempId: "p1", name: "" });
        projectIds.add("p1");
        projectTempId = "p1";
        warnings.push("未识别到项目名，请在预览中补充项目名");
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

export interface ChatMessageContent {
  role: string;
  content: unknown;
}

/** M13 3.3 按文件类型拆模型：Excel/图片优先用专用模型，未配置回退默认模型。 */
function resolveModel(kind: "image" | "excel"): string {
  const fallback = process.env.SILICONFLOW_MODEL || "Qwen/Qwen3.5-9B";
  if (kind === "excel") return process.env.SILICONFLOW_EXCEL_MODEL || fallback;
  if (kind === "image") return process.env.SILICONFLOW_IMAGE_MODEL || fallback;
  return fallback;
}

/** M13 AI 调整排期：文字模型回退链 adjust → excel → 默认。 */
export function resolveTextModel(kind: "adjust" | "excel" = "excel"): string {
  const fallback = process.env.SILICONFLOW_MODEL || "Qwen/Qwen3.5-9B";
  if (kind === "adjust") {
    return process.env.SILICONFLOW_SCHEDULE_ADJUST_MODEL || process.env.SILICONFLOW_EXCEL_MODEL || fallback;
  }
  return process.env.SILICONFLOW_EXCEL_MODEL || fallback;
}

/** 调 /chat/completions，返回 JSON 草稿原始对象 + usage。 */
export async function callChat(
  messages: ChatMessageContent[],
  model: string
): Promise<{ raw: unknown; usage: CalendarImportUsage }> {
  const apiKey = process.env.SILICONFLOW_API_KEY;
  if (!apiKey) {
    throw new AiParseError("AI_NOT_CONFIGURED", "AI 未配置（缺少 SILICONFLOW_API_KEY）");
  }
  const startedAt = Date.now();

  const controller = new AbortController();
  // M13 R2 复测：60s 硬超时容易误杀，改环境变量可配（默认 120s）
  const timeoutMs = Number(process.env.SILICONFLOW_TIMEOUT_MS || 120_000);
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
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
        // M13 3.4：VL 模型不支持 `enable_thinking` 参数（硅基流动会报错），
        // 只对非 VL 的 Qwen3 系关闭思考，才能直接返回 JSON 正文。
        ...(/Qwen3/i.test(model) && !/Qwen3-VL/i.test(model) ? { enable_thinking: false } : {}),
      }),
      signal: controller.signal,
    });
  } catch (e) {
    if ((e as Error)?.name === "AbortError") {
      throw new AiParseError("AI_TIMEOUT", "AI 识别超时，请重试");
    }
    throw new AiParseError("AI_NETWORK_ERROR", "AI 服务请求失败");
  } finally {
    clearTimeout(timeoutId);
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
  const now = new Date();
  const messages: ChatMessageContent[] = [{ role: "system", content: buildSystemPrompt(now) }];
  const filename = input.filename?.trim() ? input.filename.trim() : undefined;

  if (input.kind === "image") {
    const base64 = input.fileBuffer.toString("base64");
    const mime = input.mimeType || "image/png";
    messages.push({
      role: "user",
      content: [
        { type: "image_url", image_url: { url: `data:${mime};base64,${base64}` } },
        {
          type: "text",
          text: `请识别图片中的项目排期，输出 CalendarImportDraft JSON。${filename ? `\n文件名：${filename}` : ""}`,
        },
      ],
    });
  } else {
    messages.push({
      role: "user",
      content: `请识别以下表格文本中的项目排期，输出 CalendarImportDraft JSON。${filename ? `\n文件名：${filename}` : ""}\n\n${input.excelText ?? ""}`,
    });
  }

  const model = resolveModel(input.kind);
  const { raw, usage } = await callChat(messages, model);
  const draft = normalizeDraft(raw, now.getFullYear());
  return { draft, usage };
}
