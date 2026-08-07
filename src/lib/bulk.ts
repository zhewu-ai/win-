import { NextResponse } from "next/server";

export const MAX_BULK_IDS = 100;

/** 校验并归一化批量操作 ids：去重、单次 ≤100、非空字符串数组。 */
export function resolveBulkIds(body: unknown): {
  ids: string[];
  error?: NextResponse;
} {
  const raw = (body as { ids?: unknown } | null)?.ids;
  if (!Array.isArray(raw) || raw.length === 0) {
    return {
      ids: [],
      error: NextResponse.json(
        { ok: false, error: "INVALID_REQUEST", message: "ids 必须是非空数组" },
        { status: 400 }
      ),
    };
  }
  if (raw.some((id) => typeof id !== "string" || id.length === 0)) {
    return {
      ids: [],
      error: NextResponse.json(
        { ok: false, error: "INVALID_REQUEST" },
        { status: 400 }
      ),
    };
  }
  const ids = Array.from(new Set(raw as string[]));
  if (ids.length > MAX_BULK_IDS) {
    return {
      ids: [],
      error: NextResponse.json(
        {
          ok: false,
          error: "INVALID_REQUEST",
          message: `单次最多 ${MAX_BULK_IDS} 条`,
        },
        { status: 400 }
      ),
    };
  }
  return { ids };
}
