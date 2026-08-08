import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authOrResponse } from "@/lib/auth";
import { recordUserActivity } from "@/lib/activity";
import { addStorageUsed, getStorageState } from "@/lib/storage";
import { QUOTA_EXCEEDED_MESSAGE } from "@/lib/storage";
import sharp from "sharp";
import path from "path";
import fs from "fs/promises";

export const dynamic = "force-dynamic";

const ALLOWED_AVATAR_MIMES = ["image/jpeg", "image/png", "image/webp"];
const AVATAR_MAX_SIZE_BYTES = 1024 * 1024; // 1 MB
const AVATAR_MAX_DIMENSION = 4096;
const AVATAR_OUTPUT_DIMENSION = 512;
const AVATAR_TARGET_BYTES = 256 * 1024;
// 从高到低降质，找到第一个 ≤256KB 的输出
const AVATAR_WEBP_QUALITY_STEPS = [80, 70, 60, 50, 40, 30, 20, 10, 5];

/**
 * 服务端缩放 + 压缩：等比缩放到不超过 512x512，输出 webp 且 ≤256KB。
 * 全流程在内存完成，只返回最终 Buffer，调用方确认额度后再落盘。
 */
async function compressAvatar(buffer: Buffer): Promise<Buffer> {
  let last: Buffer | null = null;
  for (const quality of AVATAR_WEBP_QUALITY_STEPS) {
    last = await sharp(buffer)
      .rotate()
      .resize(AVATAR_OUTPUT_DIMENSION, AVATAR_OUTPUT_DIMENSION, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality })
      .toBuffer();
    if (last.length <= AVATAR_TARGET_BYTES) return last;
  }
  // 极低质量仍超 256KB 时兜底（512x512 的 webp 几乎不可能出现）
  return last ?? Buffer.alloc(0);
}

// 与 /api/auth/me 返回字段一致，但绝不返回 avatarStoragePath / passwordHash
const AVATAR_USER_SELECT = {
  id: true,
  username: true,
  email: true,
  displayName: true,
  avatarColor: true,
  avatarUrl: true,
  avatarMimeType: true,
  avatarSize: true,
  storageQuotaBytes: true,
  storageUsedBytes: true,
  role: true,
  status: true,
  mustChangePassword: true,
} as const;

function avatarDir(uploadDir: string): string {
  return path.resolve(uploadDir, "avatars");
}

/** 失败时清理刚写入的文件，避免孤儿文件。 */
async function unlinkQuiet(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch {
    // 文件已不存在也视为成功
  }
}

export async function POST(request: Request) {
  const session = await authOrResponse();
  if (session instanceof NextResponse) return session;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: "INVALID_REQUEST" },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { ok: false, error: "INVALID_REQUEST" },
      { status: 400 }
    );
  }

  if (!ALLOWED_AVATAR_MIMES.includes(file.type)) {
    return NextResponse.json(
      { ok: false, error: "UNSUPPORTED_AVATAR_TYPE", message: "仅支持 JPG / PNG / WebP 图片" },
      { status: 400 }
    );
  }

  if (file.size > AVATAR_MAX_SIZE_BYTES) {
    return NextResponse.json(
      { ok: false, error: "AVATAR_TOO_LARGE", message: "头像图片不能超过 1MB" },
      { status: 413 }
    );
  }

  // 用 sharp 校验真实图片，拦截伪装成图片的可执行文件
  const buffer = Buffer.from(await file.arrayBuffer());
  const metadata = await sharp(buffer).metadata().catch(() => null);
  if (!metadata) {
    return NextResponse.json(
      { ok: false, error: "UNSUPPORTED_AVATAR_TYPE", message: "文件不是有效图片" },
      { status: 400 }
    );
  }

  // 原始图片尺寸上限：先拒绝超大图，避免无保护解码
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (width > AVATAR_MAX_DIMENSION || height > AVATAR_MAX_DIMENSION) {
    return NextResponse.json(
      {
        ok: false,
        error: "AVATAR_DIMENSIONS_TOO_LARGE",
        message: "头像图片尺寸不能超过 4096 x 4096",
      },
      { status: 413 }
    );
  }

  // 服务端压缩：等比缩放到 ≤512x512、webp 输出 ≤256KB，全流程在内存完成
  const compressed = await compressAvatar(buffer);

  // 读取当前头像占用（替换时要先释放旧头像额度）
  const current = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { avatarStoragePath: true, avatarSize: true },
  });

  const oldAvatarSize = current?.avatarSize ?? 0;

  // 额度检查：按压缩后大小计算，必须在写文件之前，超额不落盘、不留孤儿文件
  const storage = await getStorageState(session.userId);
  if (storage.used - oldAvatarSize + compressed.length > storage.quota) {
    return NextResponse.json(
      {
        ok: false,
        error: "STORAGE_QUOTA_EXCEEDED",
        message: QUOTA_EXCEEDED_MESSAGE,
      },
      { status: 413 }
    );
  }

  const filename =
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8) + ".webp";
  const dir = avatarDir(process.env.UPLOAD_DIR || "./uploads");
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, filename);

  await fs.writeFile(filePath, compressed);

  const storagePath = `avatars/${filename}`;
  const url = `/api/files/${storagePath}`;

  try {
    await prisma.user.update({
      where: { id: session.userId },
      data: {
        avatarUrl: url,
        avatarStoragePath: storagePath,
        avatarMimeType: "image/webp",
        avatarSize: compressed.length,
      },
    });
  } catch (e) {
    // 写库失败：删除刚写入的头像文件，避免孤儿文件
    await unlinkQuiet(filePath);
    throw e;
  }

  // 替换时删除旧头像文件（尽力而为，库里已指向新文件）
  if (current?.avatarStoragePath) {
    await unlinkQuiet(path.resolve(process.env.UPLOAD_DIR || "./uploads", current.avatarStoragePath));
  }

  await addStorageUsed(session.userId, compressed.length - oldAvatarSize);

  await recordUserActivity(session.userId, "change_avatar");

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: AVATAR_USER_SELECT,
  });

  return NextResponse.json({ ok: true, user });
}

export async function DELETE() {
  const session = await authOrResponse();
  if (session instanceof NextResponse) return session;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      avatarStoragePath: true,
      avatarSize: true,
    },
  });

  if (user?.avatarStoragePath) {
    await unlinkQuiet(
      path.resolve(process.env.UPLOAD_DIR || "./uploads", user.avatarStoragePath)
    );
  }

  await prisma.user.update({
    where: { id: session.userId },
    data: {
      avatarUrl: null,
      avatarStoragePath: null,
      avatarMimeType: null,
      avatarSize: 0,
    },
  });

  await addStorageUsed(session.userId, -(user?.avatarSize ?? 0));

  await recordUserActivity(session.userId, "change_avatar");

  const updated = await prisma.user.findUnique({
    where: { id: session.userId },
    select: AVATAR_USER_SELECT,
  });

  return NextResponse.json({ ok: true, user: updated });
}
