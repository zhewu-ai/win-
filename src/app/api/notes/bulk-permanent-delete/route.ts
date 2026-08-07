import { NextResponse } from "next/server";
import { authOrResponse } from "@/lib/auth";
import { resolveBulkIds } from "@/lib/bulk";
import { hardDeleteNotes } from "@/lib/permanent-delete";

export const dynamic = "force-dynamic";

/** 批量永久删除：复用单条永久删除的安全逻辑（删 Note/Attachment/文件/释放空间）。 */
export async function POST(request: Request) {
  const session = await authOrResponse();
  if (session instanceof NextResponse) return session;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "INVALID_REQUEST" },
      { status: 400 }
    );
  }

  const { ids, error } = resolveBulkIds(body);
  if (error) return error;

  const { deletedIds, notFoundIds } = await hardDeleteNotes(session.userId, ids);
  return NextResponse.json({ ok: true, processedIds: deletedIds, notFoundIds });
}
