import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { serializeNote } from "@/lib/note-serializer";
import path from "path";
import fs from "fs/promises";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const src = await prisma.note.findFirst({
    where: { id: params.id, userId: session.userId, deletedAt: null },
    include: { attachments: true },
  });

  if (!src) {
    return NextResponse.json(
      { ok: false, error: "NOT_FOUND" },
      { status: 404 }
    );
  }

  const newNote = await prisma.note.create({
    data: {
      userId: session.userId,
      title: src.title ? `${src.title} 副本` : "副本",
      content: src.content,
      color: src.color,
      mode: src.mode,
      checklistItems: src.checklistItems,
      checklistGroups: src.checklistGroups,
      isPinned: false,
      isArchived: false,
      sortOrder: Math.floor(Date.now() / 1000),
    },
  });

  // Duplicate attachment files + records so the copy is self-contained
  const uploadDir = process.env.UPLOAD_DIR || "./uploads";
  const destDir = path.resolve(uploadDir, "notes", newNote.id);
  await fs.mkdir(destDir, { recursive: true });

  for (const att of src.attachments) {
    const filename = path.basename(att.storagePath);
    const destStorage = path.join("notes", newNote.id, filename);
    const destUrl = `/api/files/${destStorage.replace(/\\/g, "/")}`;
    try {
      await fs.copyFile(
        path.resolve(uploadDir, att.storagePath),
        path.join(destDir, filename)
      );
    } catch {
      // Source file missing — skip this attachment
      continue;
    }
    await prisma.attachment.create({
      data: {
        userId: session.userId,
        noteId: newNote.id,
        type: att.type,
        url: destUrl,
        storagePath: destStorage,
        filename: att.filename,
        mimeType: att.mimeType,
        size: att.size,
        width: att.width,
        height: att.height,
      },
    });
  }

  const full = await prisma.note.findUnique({
    where: { id: newNote.id },
    include: { attachments: true },
  });

  return NextResponse.json(
    serializeNote(full as unknown as Record<string, unknown>)
  );
}
