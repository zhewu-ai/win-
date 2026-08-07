import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authOrResponse } from "@/lib/auth";
import path from "path";
import fs from "fs/promises";
import { addStorageUsed, noteSizeBytes } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await authOrResponse();
  if (session instanceof NextResponse) return session;

  const note = await prisma.note.findFirst({
    where: {
      id: params.id,
      userId: session.userId,
      deletedAt: { not: null },
    },
    include: { attachments: true },
  });

  if (!note) {
    return NextResponse.json(
      { ok: false, error: "NOT_FOUND" },
      { status: 404 }
    );
  }

  const uploadDir = process.env.UPLOAD_DIR || "./uploads";

  // Delete attachment files from disk
  for (const att of note.attachments) {
    const filePath = path.resolve(uploadDir, att.storagePath);
    try {
      await fs.unlink(filePath);
    } catch {
      // File may be missing — continue cleanup
    }
  }

  // Remove attachment directory if it exists
  const noteDir = path.resolve(uploadDir, "notes", params.id);
  try {
    await fs.rm(noteDir, { recursive: true, force: true });
  } catch {
    // Directory may not exist — proceed
  }

  // Delete attachments from DB, then hard delete the note
  await prisma.attachment.deleteMany({ where: { noteId: params.id } });
  await prisma.note.delete({ where: { id: params.id } });

  // 永久删除才释放空间：便签文本 + 附件
  const released =
    noteSizeBytes(note) +
    note.attachments.reduce((s, att) => s + att.size, 0);
  await addStorageUsed(session.userId, -released);

  return NextResponse.json({ ok: true });
}
