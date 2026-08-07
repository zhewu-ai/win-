import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authOrResponse } from "@/lib/auth";
import { resolveBulkIds } from "@/lib/bulk";

export const dynamic = "force-dynamic";

/** 批量取消归档：仅操作当前用户未删除的便签，置 isArchived=false。 */
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
      deletedAt: null,
    },
    select: { id: true },
  });
  const ownedIds = owned.map((n) => n.id);
  if (ownedIds.length > 0) {
    await prisma.note.updateMany({
      where: { id: { in: ownedIds } },
      data: { isArchived: false },
    });
  }

  const ownedSet = new Set(ownedIds);
  const notFoundIds = ids.filter((id) => !ownedSet.has(id));
  return NextResponse.json({ ok: true, processedIds: ownedIds, notFoundIds });
}
