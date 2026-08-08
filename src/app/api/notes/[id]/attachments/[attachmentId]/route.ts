import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authOrResponse } from "@/lib/auth";
import { recordUserActivity } from "@/lib/activity";
import path from "path";
import fs from "fs/promises";
import { addStorageUsed } from "@/lib/storage";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  const { id, attachmentId } = await params;
  const session = await authOrResponse();
  if (session instanceof NextResponse) return session;

  // Find attachment and verify ownership
  const attachment = await prisma.attachment.findFirst({
    where: {
      id: attachmentId,
      noteId: id,
      userId: session.userId,
    },
  });

  if (!attachment) {
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  // Delete DB record first
  await prisma.attachment.delete({
    where: { id: attachmentId },
  });

  await addStorageUsed(session.userId, -attachment.size);

  // Delete local file; ignore if already missing
  const uploadDir = process.env.UPLOAD_DIR || "./uploads";
  const filePath = path.resolve(uploadDir, attachment.storagePath);
  try {
    await fs.unlink(filePath);
  } catch {
    // File already deleted — still return success
  }

  await recordUserActivity(session.userId, "delete_attachment");

  return NextResponse.json({ ok: true });
}
