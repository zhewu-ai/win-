import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authOrResponse } from "@/lib/auth";
import { recordUserActivity } from "@/lib/activity";

// 删除标签：删全部绑定 + 删标签本体。affectedNotes = 受影响便签数（按 noteId 去重）。
// 提示：含 `#name` 正文的便签下次保存会重建 auto 绑定（预期行为，前端删除确认里提示）。
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await authOrResponse();
    if (session instanceof NextResponse) return session;

    const tag = await prisma.noteTag.findFirst({
      where: { id, userId: session.userId },
    });
    if (!tag) {
      return NextResponse.json(
        { ok: false, error: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const bindings = await prisma.noteTagBinding.findMany({
      where: { tagId: id, userId: session.userId },
      select: { noteId: true },
    });
    const affectedNotes = new Set(bindings.map((b) => b.noteId)).size;

    await prisma.$transaction([
      prisma.noteTagBinding.deleteMany({
        where: { tagId: id, userId: session.userId },
      }),
      prisma.noteTag.delete({ where: { id } }),
    ]);

    await recordUserActivity(session.userId, "delete_tag", {
      count: affectedNotes,
    });
    return NextResponse.json({ ok: true, affectedNotes });
  } catch (e) {
    console.error("DELETE /api/note-tags/[id] error:", e);
    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
