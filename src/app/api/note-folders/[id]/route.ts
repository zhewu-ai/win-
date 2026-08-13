import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authOrResponse } from "@/lib/auth";
import { recordUserActivity } from "@/lib/activity";

const FOLDER_NAME_MAX = 50;
const FOLDER_NAME_EXISTS_ERROR = "FOLDER_NAME_EXISTS";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await authOrResponse();
  if (session instanceof NextResponse) return session;

  const folder = await prisma.noteFolder.findFirst({
    where: { id, userId: session.userId, deletedAt: null },
  });
  if (!folder) {
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (
      typeof body?.name !== "string" ||
      name.length === 0 ||
      name.length > FOLDER_NAME_MAX
    ) {
      return NextResponse.json(
        { ok: false, error: "INVALID_FOLDER_NAME" },
        { status: 400 }
      );
    }
    if (name === folder.name) {
      return NextResponse.json({ ok: true, folder });
    }

    const dup = await prisma.noteFolder.findFirst({
      where: { userId: session.userId, name, deletedAt: null, id: { not: id } },
    });
    if (dup) {
      return NextResponse.json(
        { ok: false, error: FOLDER_NAME_EXISTS_ERROR },
        { status: 409 }
      );
    }

    const updated = await prisma.noteFolder.update({
      where: { id },
      data: { name },
    });

    await recordUserActivity(session.userId, "rename_folder");

    return NextResponse.json({ ok: true, folder: updated });
  } catch {
    return NextResponse.json(
      { ok: false, error: "INVALID_REQUEST" },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await authOrResponse();
  if (session instanceof NextResponse) return session;

  const folder = await prisma.noteFolder.findFirst({
    where: { id, userId: session.userId, deletedAt: null },
  });
  if (!folder) {
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  // 事务：先清空该文件夹下便签的 folderId（软删不删便签），再软删文件夹
  const [affectedNotes] = await prisma.$transaction([
    prisma.note.updateMany({
      where: { userId: session.userId, folderId: id, deletedAt: null },
      data: { folderId: null },
    }),
    prisma.noteFolder.update({
      where: { id },
      data: { deletedAt: new Date() },
    }),
  ]);

  await recordUserActivity(session.userId, "delete_folder", {
    count: affectedNotes.count,
  });

  return NextResponse.json({ ok: true, affectedNotes: affectedNotes.count });
}
