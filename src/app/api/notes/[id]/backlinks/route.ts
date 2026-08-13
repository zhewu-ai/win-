import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authOrResponse } from "@/lib/auth";
import { displayPlainText } from "@/lib/link-parser";

const SUMMARY_MAX = 80;

/** 取正文首非空行作摘要：内链语法替换为显示标题，截断 ~80 字符。 */
function summarize(content: string | null): string {
  const text = content ?? "";
  const firstLine =
    text
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.length > 0) ?? "";
  const plain = displayPlainText(firstLine);
  if (plain.length <= SUMMARY_MAX) return plain;
  return plain.slice(0, SUMMARY_MAX).trimEnd() + "…";
}

// 反向链接：所有「正文里 [[note:id|…]] 指向本便签」的未删除来源便签。
// 已归档来源显示 + 灰标「已归档」；已删除来源由 deletedAt 过滤不出现。
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await authOrResponse();
  if (session instanceof NextResponse) return session;

  const note = await prisma.note.findFirst({
    where: { id, userId: session.userId, deletedAt: null },
    select: { id: true },
  });
  if (!note) {
    return NextResponse.json(
      { ok: false, error: "NOT_FOUND" },
      { status: 404 }
    );
  }

  const edges = await prisma.noteLinkEdge.findMany({
    where: {
      userId: session.userId,
      toNoteId: id,
      fromNote: { is: { deletedAt: null } },
    },
    include: {
      fromNote: {
        select: {
          id: true,
          title: true,
          content: true,
          updatedAt: true,
          isArchived: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    ok: true,
    backlinks: edges.map((e) => ({
      id: e.fromNote.id,
      title: e.fromNote.title,
      summary: summarize(e.fromNote.content),
      updatedAt: e.fromNote.updatedAt,
      isArchived: e.fromNote.isArchived,
    })),
  });
}
