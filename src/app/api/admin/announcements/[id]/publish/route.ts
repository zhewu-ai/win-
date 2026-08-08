import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, toErrorResponse } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** 发布公告：draft → published，记录发布时间。 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await requireAdmin();

    const existing = await prisma.announcement.findUnique({
      where: { id: id },
      select: { id: true, status: true },
    });
    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "NOT_FOUND" },
        { status: 404 }
      );
    }
    if (existing.status === "archived") {
      return NextResponse.json(
        { ok: false, error: "ALREADY_ARCHIVED", message: "已归档公告不可发布" },
        { status: 400 }
      );
    }

    const announcement = await prisma.announcement.update({
      where: { id: id },
      data: { status: "published", publishedAt: new Date() },
    });

    return NextResponse.json({ ok: true, announcement });
  } catch (e) {
    return toErrorResponse(e);
  }
}
