import { NextResponse } from "next/server";
import { requireAdmin, toErrorResponse } from "@/lib/auth";
import { excelToText } from "@/lib/excel-text";
import { parseScheduleFile, AiParseError } from "@/lib/siliconflow";
import type { CalendarImportDraft, CalendarImportYearNotice } from "@/types";

// M13 AI 排期导入：识别上传的图片/Excel，返回可编辑草稿。
// 仅管理员；不直接入库（写入走 /confirm）；日志脱敏（不打印 key/base64/文件内容）。

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_EXCEL_BYTES = 5 * 1024 * 1024;

const IMAGE_MIMES = ["image/png", "image/jpeg", "image/webp"];
const IMAGE_EXTS = ["png", "jpg", "jpeg", "webp"];
const EXCEL_EXTS = ["xlsx", "xls"];

function extOf(filename: string): string {
  const i = filename.lastIndexOf(".");
  return i >= 0 ? filename.slice(i + 1).toLowerCase() : "";
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json({ ok: false, error: "INVALID_REQUEST" }, { status: 400 });
    }

    const kind = String(formData.get("kind") ?? "");
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "INVALID_REQUEST" }, { status: 400 });
    }
    if (kind !== "image" && kind !== "excel") {
      return NextResponse.json({ ok: false, error: "INVALID_KIND" }, { status: 400 });
    }

    const filename = file.name || "untitled";
    const mime = file.type || "";
    const ext = extOf(filename);

    // PDF：明确拒绝且不调 AI
    if (mime === "application/pdf" || ext === "pdf") {
      return NextResponse.json(
        { ok: false, error: "PDF_NOT_SUPPORTED", message: "暂不支持 PDF，请上传图片或 Excel。" },
        { status: 400 }
      );
    }

    const maxBytes = kind === "image" ? MAX_IMAGE_BYTES : MAX_EXCEL_BYTES;
    if (file.size > maxBytes) {
      return NextResponse.json(
        { ok: false, error: "FILE_TOO_LARGE", message: "文件过大，请压缩后重试。" },
        { status: 413 }
      );
    }

    // 类型校验：图片看 mime/扩展名；Excel 看扩展名（mime 可能为 octet-stream）
    const isImage = kind === "image" && (IMAGE_MIMES.includes(mime) || IMAGE_EXTS.includes(ext));
    const isExcel = kind === "excel" && EXCEL_EXTS.includes(ext);
    if (!isImage && !isExcel) {
      return NextResponse.json(
        { ok: false, error: "UNSUPPORTED_TYPE", message: "仅支持图片和 Excel。" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Excel：先提取结构化文本喂给 AI
    let excelText: string | undefined;
    if (kind === "excel") {
      try {
        excelText = excelToText(buffer, filename).text;
      } catch {
        return NextResponse.json(
          { ok: false, error: "EXCEL_READ_FAILED", message: "Excel 读取失败，请确认文件未损坏。" },
          { status: 422 }
        );
      }
    }

    const { draft, usage } = await parseScheduleFile({
      kind,
      fileBuffer: buffer,
      mimeType: mime || undefined,
      filename,
      excelText,
    });

    // 2.2 异常年份检测：80%+ 条目落在当前年 ±1 年之外 → 给前端批量修正建议
    const currentYear = new Date().getFullYear();
    let yearNotice: CalendarImportYearNotice | null = null;
    if (draft.items.length > 0) {
      const abnormal = draft.items.filter((it) => {
        const y = Number(it.startDate.slice(0, 4));
        return Number.isFinite(y) && (y < currentYear - 1 || y > currentYear + 1);
      });
      if (abnormal.length >= draft.items.length * 0.8) {
        const counts = new Map<string, number>();
        for (const it of abnormal) {
          const y = it.startDate.slice(0, 4);
          counts.set(y, (counts.get(y) ?? 0) + 1);
        }
        const detectedYear = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? String(currentYear);
        yearNotice = { detectedYear, abnormalCount: abnormal.length, total: draft.items.length, currentYear };
      }
    }

    // 脱敏日志：只记模型/耗时/token/规模，不记 key、base64、文件内容
    console.log(
      `[calendar-import] parse ok kind=${kind} file=${filename} size=${buffer.length}B ` +
        `model=${usage.model} prompt=${usage.promptTokens} completion=${usage.completionTokens} ` +
        `ms=${usage.durationMs} projects=${draft.projects.length} items=${draft.items.length} ` +
        `warnings=${draft.warnings.length}`
    );

    return NextResponse.json({ ok: true, draft: draft as CalendarImportDraft, usage, yearNotice });
  } catch (e) {
    if (e instanceof AiParseError) {
      const message =
        AI_MESSAGES[e.code] ?? "识别失败，请换一张更清晰的图片或手动添加。";
      return NextResponse.json(
        { ok: false, error: e.code, message },
        { status: e.code === "AI_NOT_CONFIGURED" ? 503 : 422 }
      );
    }
    console.error("[calendar-import] parse failed", e);
    return toErrorResponse(e);
  }
}

const AI_MESSAGES: Record<string, string> = {
  AI_TIMEOUT: "AI 识别超时，请重试。",
  AI_NETWORK_ERROR: "AI 服务连接失败，请稍后重试。",
  AI_HTTP_ERROR: "AI 服务异常，请稍后重试。",
  AI_NOT_CONFIGURED: "AI 未配置，请联系管理员。",
  AI_EMPTY: "AI 未识别到内容，请换一张更清晰的图片。",
  AI_INVALID_JSON: "AI 返回格式错误，已保留原始识别文本，请重试。",
  INVALID_DRAFT: "AI 返回无效草稿，请重试。",
};
