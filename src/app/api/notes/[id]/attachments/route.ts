import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authOrResponse } from "@/lib/auth";
import { recordUserActivity } from "@/lib/activity";
import sharp from "sharp";
import path from "path";
import fs from "fs/promises";
import {
  QUOTA_EXCEEDED_ERROR,
  QUOTA_EXCEEDED_MESSAGE,
  addStorageUsed,
  getStorageState,
} from "@/lib/storage";

const ALLOWED_MIMES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

function getConfig() {
  const uploadDir = process.env.UPLOAD_DIR || "./uploads";
  const maxSizeMB = parseInt(process.env.MAX_IMAGE_SIZE_MB || "5", 10);
  const maxPerNote = parseInt(process.env.MAX_IMAGES_PER_NOTE || "12", 10);
  return { uploadDir, maxSizeMB, maxPerNote };
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await authOrResponse();
  if (session instanceof NextResponse) return session;

  // Verify note exists, belongs to user, and is not permanently deleted
  const note = await prisma.note.findFirst({
    where: {
      id: params.id,
      userId: session.userId,
    },
  });

  if (!note) {
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  // Do not allow uploads to trashed notes
  if (note.deletedAt) {
    return NextResponse.json(
      { ok: false, error: "Cannot upload to a deleted note" },
      { status: 400 }
    );
  }

  const { uploadDir, maxSizeMB, maxPerNote } = getConfig();
  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  // Parse multipart form
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_FORM_DATA" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "FILE_REQUIRED" }, { status: 400 });
  }

  // Validate MIME type
  if (!ALLOWED_MIMES.includes(file.type)) {
    return NextResponse.json(
      { ok: false, error: `Invalid file type. Allowed: ${ALLOWED_MIMES.join(", ")}` },
      { status: 400 }
    );
  }

  // Validate file size
  if (file.size > maxSizeBytes) {
    return NextResponse.json(
      { ok: false, error: `File too large. Maximum: ${maxSizeMB}MB` },
      { status: 400 }
    );
  }

  // Enforce per-note limit
  const existingCount = await prisma.attachment.count({
    where: { noteId: params.id },
  });

  if (existingCount >= maxPerNote) {
    return NextResponse.json(
      { ok: false, error: `Maximum ${maxPerNote} images per note` },
      { status: 400 }
    );
  }

  // 额度检查：必须在写文件之前，超额度不落盘、不留孤儿文件
  const storage = await getStorageState(session.userId);
  if (storage.used + file.size > storage.quota) {
    return NextResponse.json(
      {
        ok: false,
        error: QUOTA_EXCEEDED_ERROR,
        message: QUOTA_EXCEEDED_MESSAGE,
      },
      { status: 413 }
    );
  }

  // Determine file extension
  const ext = file.type.split("/")[1] || "jpg";

  // Generate unique ID for the attachment
  const attachmentId =
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const filename = `${attachmentId}.${ext}`;

  // Build storage path and URL
  const relativeDir = path.join("notes", params.id);
  const noteDir = path.resolve(uploadDir, relativeDir);
  const storagePath = path.join(relativeDir, filename);
  const url = `/api/files/${relativeDir}/${filename}`;

  // Ensure directory exists
  await fs.mkdir(noteDir, { recursive: true });

  // 真实图片校验：sharp 解析头部，失败/无尺寸直接 400，伪装文件不落盘
  const buffer = Buffer.from(await file.arrayBuffer());
  const metadata = await sharp(buffer).metadata().catch(() => null);
  if (!metadata) {
    return NextResponse.json(
      { ok: false, error: "INVALID_IMAGE_FILE", message: "文件不是有效图片" },
      { status: 400 }
    );
  }
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  // 原始尺寸上限：先拒绝超大图，避免解码/存储滥用
  const MAX_IMAGE_DIMENSION = 8192;
  if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
    return NextResponse.json(
      {
        ok: false,
        error: "IMAGE_TOO_LARGE",
        message: `图片尺寸不能超过 ${MAX_IMAGE_DIMENSION} x ${MAX_IMAGE_DIMENSION}`,
      },
      { status: 413 }
    );
  }

  // Write file to disk
  await fs.writeFile(path.join(noteDir, filename), buffer);

  // Create DB record（写库失败删除已写文件，避免孤儿文件）
  const attachment = await prisma.attachment
    .create({
      data: {
        id: attachmentId,
        userId: session.userId,
        noteId: params.id,
        type: "image",
        url,
        storagePath,
        filename: file.name,
        mimeType: file.type,
        size: file.size,
        width,
        height,
      },
    })
    .catch(async (e: unknown) => {
      await fs.unlink(path.join(noteDir, filename)).catch(() => {});
      throw e;
    });

  await addStorageUsed(session.userId, file.size);

  await recordUserActivity(session.userId, "upload_attachment");

  return NextResponse.json({
    attachment: {
      id: attachment.id,
      noteId: attachment.noteId,
      type: attachment.type,
      url: attachment.url,
      filename: attachment.filename,
      mimeType: attachment.mimeType,
      size: attachment.size,
      width: attachment.width,
      height: attachment.height,
      createdAt: attachment.createdAt.toISOString(),
    },
  });
}
