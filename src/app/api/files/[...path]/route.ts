import { NextResponse } from "next/server";
import { authOrResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import path from "path";
import fs from "fs/promises";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { path: string[] } }
) {
  const session = await authOrResponse();
  if (session instanceof NextResponse) return session;

  const rawPath = params.path.join("/");
  const uploadDir = process.env.UPLOAD_DIR || "./uploads";
  const resolvedDir = path.resolve(uploadDir);
  const resolvedPath = path.resolve(resolvedDir, rawPath);

  // Path traversal prevention: use path.relative to detect escape
  const rel = path.relative(resolvedDir, resolvedPath);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  // Parse noteId from URL pattern: notes/{noteId}/{filename}
  // Verify attachment DB record belongs to current user
  const segments = params.path;
  let avatarServe = false;
  if (segments.length >= 2 && segments[0] === "notes") {
    const noteId = segments[1];
    const attachment = await prisma.attachment.findFirst({
      where: {
        noteId,
        userId: session.userId,
        storagePath: rawPath,
      },
    });
    if (!attachment) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }
  } else if (segments.length === 2 && segments[0] === "avatars") {
    // 头像：仅本人或管理员可读（管理员用户列表需要展示他人头像）
    const owner = await prisma.user.findFirst({
      where: { avatarStoragePath: rawPath },
      select: { id: true },
    });
    if (!owner) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }
    if (owner.id !== session.userId) {
      const sessionUser = await prisma.user.findUnique({
        where: { id: session.userId },
        select: { role: true },
      });
      if (sessionUser?.role !== "admin") {
        return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
      }
    }
    avatarServe = true;
  } else {
    // Unknown path pattern — reject
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  // Check file exists
  let fileBuffer: Buffer;
  try {
    fileBuffer = await fs.readFile(resolvedPath);
  } catch {
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  // Determine MIME from extension
  const ext = path.extname(resolvedPath).toLowerCase().slice(1);
  const mimeMap: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
  };
  const mimeType = mimeMap[ext] || "application/octet-stream";

  // 头像删除后旧 URL 应立即失效：不缓存（no-store）。附件保留现有私有缓存。
  const cacheControl = avatarServe
    ? "private, no-store"
    : "private, max-age=86400";

  return new NextResponse(new Uint8Array(fileBuffer), {
    status: 200,
    headers: {
      "Content-Type": mimeType,
      "Cache-Control": cacheControl,
    },
  });
}
