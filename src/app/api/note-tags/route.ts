import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authOrResponse } from "@/lib/auth";
import { recordUserActivity } from "@/lib/activity";
import { TAG_NAME_MAX } from "@/lib/tag-parser";

// 标签列表：只列出「关联了未删除便签」的标签（0 绑定不出现但不删行），count 按未删便签计。
export async function GET() {
  try {
    const session = await authOrResponse();
    if (session instanceof NextResponse) return session;

    const tags = await prisma.noteTag.findMany({
      where: { userId: session.userId },
      include: {
        _count: {
          select: { bindings: { where: { note: { deletedAt: null } } } },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({
      ok: true,
      tags: tags
        .filter((t) => t._count.bindings > 0)
        .map((t) => ({ id: t.id, name: t.name, count: t._count.bindings })),
    });
  } catch (e) {
    console.error("GET /api/note-tags error:", e);
    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}

// 独立建标签（手动加标签主路径走 PATCH notes 的 tags；此端点供需要时单独建）。
export async function POST(request: Request) {
  try {
    const session = await authOrResponse();
    if (session instanceof NextResponse) return session;

    const body = await request.json();
    if (typeof body?.name !== "string") {
      return NextResponse.json(
        { ok: false, error: "INVALID_NAME" },
        { status: 400 }
      );
    }
    const name = body.name.trim();
    if (name.length === 0 || name.length > TAG_NAME_MAX) {
      return NextResponse.json(
        { ok: false, error: "INVALID_NAME" },
        { status: 400 }
      );
    }

    const existing = await prisma.noteTag.findFirst({
      where: { userId: session.userId, name },
    });
    if (existing) {
      return NextResponse.json(
        { ok: false, error: "TAG_NAME_EXISTS" },
        { status: 409 }
      );
    }

    const tag = await prisma.noteTag.create({
      data: { userId: session.userId, name },
      select: { id: true, name: true },
    });

    await recordUserActivity(session.userId, "create_tag");
    return NextResponse.json({ ok: true, tag });
  } catch (e) {
    console.error("POST /api/note-tags error:", e);
    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
