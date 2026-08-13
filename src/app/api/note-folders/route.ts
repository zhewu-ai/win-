import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authOrResponse } from "@/lib/auth";
import { recordUserActivity } from "@/lib/activity";

const FOLDER_NAME_MAX = 50;
const FOLDER_NAME_EXISTS_ERROR = "FOLDER_NAME_EXISTS";

function folderNameError(name: unknown): string | null {
  if (typeof name !== "string" || name.trim().length === 0 || name.trim().length > FOLDER_NAME_MAX) {
    return "INVALID_FOLDER_NAME";
  }
  return null;
}

export async function GET() {
  try {
    const session = await authOrResponse();
    if (session instanceof NextResponse) return session;

    // 只统计未删除、未归档的便签
    const notesScope = { userId: session.userId, deletedAt: null, isArchived: false };

    const [folders, grouped, ungroupedCount, totalCount] = await Promise.all([
      prisma.noteFolder.findMany({
        where: { userId: session.userId, deletedAt: null },
        orderBy: { createdAt: "asc" },
      }),
      prisma.note.groupBy({
        by: ["folderId"],
        where: { ...notesScope, folderId: { not: null } },
        _count: { _all: true },
      }),
      prisma.note.count({ where: { ...notesScope, folderId: null } }),
      prisma.note.count({ where: notesScope }),
    ]);

    const countByFolder = new Map(
      grouped.map((g) => [g.folderId as string, g._count._all])
    );

    return NextResponse.json({
      ok: true,
      folders: folders.map((f) => ({
        id: f.id,
        name: f.name,
        noteCount: countByFolder.get(f.id) ?? 0,
        createdAt: f.createdAt,
      })),
      ungroupedCount,
      totalCount,
    });
  } catch (e) {
    console.error("GET /api/note-folders error:", e);
    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await authOrResponse();
    if (session instanceof NextResponse) return session;

    const body = await request.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const nameError = folderNameError(name);
    if (nameError) {
      return NextResponse.json({ ok: false, error: nameError }, { status: 400 });
    }

    // 接口层防重名：同名未删除文件夹（软删后可重建同名）
    const dup = await prisma.noteFolder.findFirst({
      where: { userId: session.userId, name, deletedAt: null },
    });
    if (dup) {
      return NextResponse.json(
        { ok: false, error: FOLDER_NAME_EXISTS_ERROR },
        { status: 409 }
      );
    }

    const folder = await prisma.noteFolder.create({
      data: { userId: session.userId, name },
    });

    await recordUserActivity(session.userId, "create_folder");

    return NextResponse.json({ ok: true, folder });
  } catch (e) {
    console.error("POST /api/note-folders error:", e);
    return NextResponse.json(
      { ok: false, error: "INVALID_REQUEST" },
      { status: 400 }
    );
  }
}
