import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authOrResponse } from "@/lib/auth";
import { resolveBulkIds } from "@/lib/bulk";
import { recordUserActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

/** 批量恢复：仅操作当前用户已删除（deletedAt 非空）的便签，置 deletedAt=null。 */
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

  const owned = await prisma.note.findMany({
    where: {
      id: { in: ids },
      userId: session.userId,
      deletedAt: { not: null },
    },
    select: { id: true },
  });
  const ownedIds = owned.map((n) => n.id);
  if (ownedIds.length > 0) {
    await prisma.note.updateMany({
      where: { id: { in: ownedIds } },
      data: { deletedAt: null },
    });
  }

  const ownedSet = new Set(ownedIds);
  const notFoundIds = ids.filter((id) => !ownedSet.has(id));

  if (ownedIds.length > 0) {
    await recordUserActivity(session.userId, "restore_note", { count: ownedIds.length });
  }

  return NextResponse.json({ ok: true, processedIds: ownedIds, notFoundIds });
}
