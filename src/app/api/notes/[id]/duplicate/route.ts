import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { parseChecklistGroups, parseChecklistItems, serializeNote } from "@/lib/note-serializer";
import path from "path";
import fs from "fs/promises";
import {
  QUOTA_EXCEEDED_ERROR,
  QUOTA_EXCEEDED_MESSAGE,
  addStorageUsed,
  getStorageState,
  notePayloadSizeBytes,
} from "@/lib/storage";

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

  const newTitle = src.title ? `${src.title} 副本` : "副本";

  // 额度检查：副本占用 = 新便签文本 + 附件（源缺失附件不重复计数）
  const attSum = src.attachments.reduce((s, a) => s + a.size, 0);
  const newTextSize = notePayloadSizeBytes({
    title: newTitle,
    content: src.content,
    checklistItems: parseChecklistItems(src.checklistItems),
    checklistGroups: parseChecklistGroups(src.checklistGroups),
  });
  const storage = await getStorageState(session.userId);
  if (storage.used + newTextSize + attSum > storage.quota) {
    return NextResponse.json(
      {
        ok: false,
        error: QUOTA_EXCEEDED_ERROR,
        message: QUOTA_EXCEEDED_MESSAGE,
      },
      { status: 413 }
    );
  }

  const newNote = await prisma.note.create({
    data: {
      userId: session.userId,
      title: newTitle,
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

  let copiedBytes = 0;
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
    copiedBytes += att.size;
  }

  await addStorageUsed(session.userId, newTextSize + copiedBytes);

  const full = await prisma.note.findUnique({
    where: { id: newNote.id },
    include: { attachments: true },
  });

  return NextResponse.json(
    serializeNote(full as unknown as Record<string, unknown>)
  );
}
