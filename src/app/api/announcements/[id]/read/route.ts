import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authOrResponse } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** 记录用户已读某条已发布公告（幂等：重复调用不报错）。 */
export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await authOrResponse();
  if (session instanceof NextResponse) return session;

  const announcement = await prisma.announcement.findUnique({
    where: { id: params.id },
    select: { id: true, status: true },
  });
  if (!announcement || announcement.status !== "published") {
    return NextResponse.json(
      { ok: false, error: "NOT_FOUND" },
      { status: 404 }
    );
  }

  await prisma.announcementRead.upsert({
    where: {
      announcementId_userId: {
        announcementId: params.id,
        userId: session.userId,
      },
    },
    create: {
      announcementId: params.id,
      userId: session.userId,
    },
    update: {},
  });

  return NextResponse.json({ ok: true });
}
