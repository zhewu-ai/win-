import { NextResponse } from "next/server";
import { requireAdmin, toErrorResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** 删除废用户：仅限 disabled、非 admin、非本人、且无业务数据的用户。 */
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (e) {
    return toErrorResponse(e);
  }

  if (params.id === admin.id) {
    return NextResponse.json(
      { ok: false, error: "CANNOT_DELETE_SELF", message: "不能删除自己" },
      { status: 400 }
    );
  }

  const target = await prisma.user.findUnique({
    where: { id: params.id },
    select: { id: true, username: true, email: true, role: true, status: true },
  });
  if (!target) {
    return NextResponse.json(
      { ok: false, error: "USER_NOT_FOUND" },
      { status: 404 }
    );
  }
  if (target.role === "admin") {
    return NextResponse.json(
      { ok: false, error: "CANNOT_DELETE_ADMIN", message: "不能删除管理员" },
      { status: 400 }
    );
  }
  if (target.status !== "disabled") {
    return NextResponse.json(
      {
        ok: false,
        error: "MUST_DISABLE_FIRST",
        message: "请先禁用该用户，确认无有效数据后再删除",
      },
      { status: 400 }
    );
  }

  // 统计关键业务数据：任一存在则禁止硬删除（只保留禁用路径）
  const [notes, attachments, feedbackTickets, announcements, announcementReads] =
    await Promise.all([
      prisma.note.count({ where: { userId: params.id } }),
      prisma.attachment.count({ where: { userId: params.id } }),
      prisma.feedbackTicket.count({ where: { userId: params.id } }),
      prisma.announcement.count({ where: { createdById: params.id } }),
      prisma.announcementRead.count({ where: { userId: params.id } }),
    ]);
  const counts = {
    notes,
    attachments,
    feedbackTickets,
    announcements,
    announcementReads,
  };
  const hasData = Object.values(counts).some((n) => n > 0);
  if (hasData) {
    return NextResponse.json(
      {
        ok: false,
        error: "USER_HAS_DATA",
        message: "该用户已有数据，不能直接删除。请先禁用保留数据。",
        counts,
      },
      { status: 409 }
    );
  }

  // 仅清理未使用的邀请码关系 + 未使用的重置令牌，绝不触碰真实便签数据
  await prisma.$transaction([
    prisma.inviteCode.deleteMany({ where: { createdById: params.id } }),
    prisma.inviteCode.updateMany({
      where: { usedById: params.id },
      data: { usedById: null },
    }),
    prisma.passwordResetToken.deleteMany({ where: { userId: params.id } }),
    prisma.user.delete({ where: { id: params.id } }),
  ]);

  return NextResponse.json({ ok: true });
}
