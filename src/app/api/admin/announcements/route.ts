import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, toErrorResponse } from "@/lib/auth";

export const dynamic = "force-dynamic";

const MAX_CONTENT_LENGTH = 20000;

/** 公告列表 + 阅读统计（应看=当前 active 用户数，已读=AnnouncementRead 去重用户数，含已读用户明细）。 */
export async function GET() {
  try {
    const admin = await requireAdmin();

    const [announcements, activeUserCount] = await Promise.all([
      prisma.announcement.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          reads: {
            orderBy: { readAt: "asc" },
            select: {
              id: true,
              readAt: true,
              user: {
                select: {
                  id: true,
                  username: true,
                  email: true,
                  displayName: true,
                },
              },
            },
          },
        },
      }),
      prisma.user.count({ where: { status: "active" } }),
    ]);

    return NextResponse.json({
      activeUserCount,
      announcements: announcements.map((a) => ({
        id: a.id,
        title: a.title,
        content: a.content,
        version: a.version,
        status: a.status,
        publishedAt: a.publishedAt,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
        readCount: a.reads.length,
        activeUserCount,
        reads: a.reads.map((r) => ({
          id: r.id,
          readAt: r.readAt,
          user: {
            id: r.user.id,
            username: r.user.username,
            email: r.user.email,
            displayName: r.user.displayName,
          },
        })),
      })),
    });
  } catch (e) {
    return toErrorResponse(e);
  }
}

/** 新建公告草稿（管理员手写，禁止 AI 自动发布）。 */
export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: "INVALID_REQUEST" },
        { status: 400 }
      );
    }
    const { title, content, version } = (body ?? {}) as {
      title?: unknown;
      content?: unknown;
      version?: unknown;
    };
    const titleStr = typeof title === "string" ? title.trim() : "";
    const contentStr = typeof content === "string" ? content.trim() : "";
    if (!titleStr || !contentStr) {
      return NextResponse.json(
        { ok: false, error: "INVALID_REQUEST", message: "标题和正文不能为空" },
        { status: 400 }
      );
    }
    if (titleStr.length > 100) {
      return NextResponse.json(
        { ok: false, error: "INVALID_REQUEST", message: "标题不能超过 100 字" },
        { status: 400 }
      );
    }
    if (contentStr.length > MAX_CONTENT_LENGTH) {
      return NextResponse.json(
        {
          ok: false,
          error: "INVALID_REQUEST",
          message: `正文不能超过 ${MAX_CONTENT_LENGTH} 字`,
        },
        { status: 400 }
      );
    }
    const versionStr = typeof version === "string" ? version.trim() : "";
    if (versionStr.length > 30) {
      return NextResponse.json(
        { ok: false, error: "INVALID_REQUEST", message: "版本号不能超过 30 字" },
        { status: 400 }
      );
    }

    const announcement = await prisma.announcement.create({
      data: {
        title: titleStr,
        content: contentStr,
        version: versionStr || null,
        status: "draft",
        createdById: admin.id,
      },
    });

    return NextResponse.json({ ok: true, announcement });
  } catch (e) {
    return toErrorResponse(e);
  }
}
