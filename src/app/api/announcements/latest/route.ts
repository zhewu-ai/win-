import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authOrResponse } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** 最新已发布公告 + 当前用户是否已读。无发布公告时返回 announcement=null。 */
export async function GET() {
  const session = await authOrResponse();
  if (session instanceof NextResponse) return session;

  const latest = await prisma.announcement.findFirst({
    where: { status: "published" },
    orderBy: { publishedAt: "desc" },
    select: { id: true, title: true, content: true, version: true, publishedAt: true },
  });

  if (!latest) {
    return NextResponse.json({ announcement: null });
  }

  const read = await prisma.announcementRead.findUnique({
    where: {
      announcementId_userId: {
        announcementId: latest.id,
        userId: session.userId,
      },
    },
    select: { id: true },
  });

  return NextResponse.json({ announcement: latest, hasRead: Boolean(read) });
}
