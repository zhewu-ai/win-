import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authOrResponse } from "@/lib/auth";
import { recordUserActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

const MAX_IDS = 100;

export async function POST(request: Request) {
  const session = await authOrResponse();
  if (session instanceof NextResponse) return session;

  let body: { ids?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "INVALID_REQUEST" },
      { status: 400 }
    );
  }

  const raw = body.ids;
  if (!Array.isArray(raw) || raw.length === 0) {
    return NextResponse.json(
      { ok: false, error: "INVALID_REQUEST", message: "ids 必须是非空数组" },
      { status: 400 }
    );
  }
  if (raw.some((id) => typeof id !== "string" || id.length === 0)) {
    return NextResponse.json(
      { ok: false, error: "INVALID_REQUEST" },
      { status: 400 }
    );
  }

  // 去重，并限制单次最多 100 条
  const ids = Array.from(new Set(raw as string[]));
  if (ids.length > MAX_IDS) {
    return NextResponse.json(
      {
        ok: false,
        error: "INVALID_REQUEST",
        message: `单次最多 ${MAX_IDS} 条`,
      },
      { status: 400 }
    );
  }

  // 只软删当前用户拥有、未删除（deletedAt=null）的便签
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
      data: { deletedAt: new Date() },
    });
  }

  const ownedSet = new Set(ownedIds);
  const notFoundIds = ids.filter((id) => !ownedSet.has(id));

  if (ownedIds.length > 0) {
    await recordUserActivity(session.userId, "delete_note", { count: ownedIds.length });
  }

  return NextResponse.json({ ok: true, deletedIds: ownedIds, notFoundIds });
}
