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

  return new NextResponse(new Uint8Array(fileBuffer), {
    status: 200,
    headers: {
      "Content-Type": mimeType,
      "Cache-Control": "private, max-age=86400",
    },
  });
}
