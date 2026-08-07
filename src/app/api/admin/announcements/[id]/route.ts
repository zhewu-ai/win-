import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, toErrorResponse } from "@/lib/auth";

export const dynamic = "force-dynamic";

const MAX_CONTENT_LENGTH = 20000;

/** 编辑公告草稿的标题/正文/版本号。仅 draft 状态可编辑。 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin();

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

    const existing = await prisma.announcement.findUnique({
      where: { id: params.id },
      select: { id: true, status: true },
    });
    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "NOT_FOUND" },
        { status: 404 }
      );
    }
    if (existing.status !== "draft") {
      return NextResponse.json(
        { ok: false, error: "NOT_DRAFT", message: "仅草稿状态可编辑" },
        { status: 400 }
      );
    }

    const data: { title?: string; content?: string; version?: string | null } =
      {};
    if (title !== undefined) {
      const titleStr = typeof title === "string" ? title.trim() : "";
      if (!titleStr || titleStr.length > 100) {
        return NextResponse.json(
          { ok: false, error: "INVALID_REQUEST", message: "标题为空或超过 100 字" },
          { status: 400 }
        );
      }
      data.title = titleStr;
    }
    if (content !== undefined) {
      const contentStr = typeof content === "string" ? content.trim() : "";
      if (!contentStr || contentStr.length > MAX_CONTENT_LENGTH) {
        return NextResponse.json(
          {
            ok: false,
            error: "INVALID_REQUEST",
            message: `正文为空或超过 ${MAX_CONTENT_LENGTH} 字`,
          },
          { status: 400 }
        );
      }
      data.content = contentStr;
    }
    if (version !== undefined) {
      const versionStr = typeof version === "string" ? version.trim() : "";
      if (versionStr.length > 30) {
        return NextResponse.json(
          { ok: false, error: "INVALID_REQUEST", message: "版本号不能超过 30 字" },
          { status: 400 }
        );
      }
      data.version = versionStr || null;
    }

    const announcement = await prisma.announcement.update({
      where: { id: params.id },
      data,
    });

    return NextResponse.json({ ok: true, announcement });
  } catch (e) {
    return toErrorResponse(e);
  }
}
