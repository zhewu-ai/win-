import { NextResponse } from "next/server";
import { requireAdmin, toErrorResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import path from "path";
import fs from "fs/promises";

export const dynamic = "force-dynamic";

/**
 * 删除废用户：仅限 disabled + 非 admin + 非本人。
 * 删除时在事务内级联清理该用户个人数据（便签/附件记录/反馈/公告已读/重置token/邀请码），
 * 事务成功后尽力清理附件文件与头像文件（文件缺失不失败）。
 */
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
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      status: true,
      avatarStoragePath: true,
    },
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
        message: "请先禁用该用户，确认后删除",
      },
      { status: 400 }
    );
  }

  // 删除行前收集文件路径，供事务成功后尽力清理
  const notes = await prisma.note.findMany({
    where: { userId: params.id },
    select: {
      id: true,
      attachments: { select: { storagePath: true } },
    },
  });
  const attachmentPaths = notes.flatMap((n) =>
    n.attachments.map((a) => a.storagePath)
  );
  const noteIds = notes.map((n) => n.id);

  // 防御：普通用户不应创建公告（公告仅 admin 接口可建）；若存在则拒绝，避免外键残留
  const createdAnnouncements = await prisma.announcement.count({
    where: { createdById: params.id },
  });
  if (createdAnnouncements > 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "USER_CREATED_ANNOUNCEMENTS",
        message: "该用户曾创建公告，请先人工处理后再删除",
      },
      { status: 409 }
    );
  }

  // 事务内级联清理：先子后父，最后删 User（不维护 storageUsedBytes，User 已不存在）
  const results = await prisma.$transaction([
    prisma.attachment.deleteMany({ where: { userId: params.id } }),
    prisma.note.deleteMany({ where: { userId: params.id } }),
    prisma.feedbackTicket.deleteMany({ where: { userId: params.id } }),
    prisma.announcementRead.deleteMany({ where: { userId: params.id } }),
    prisma.passwordResetToken.deleteMany({ where: { userId: params.id } }),
    prisma.inviteCode.deleteMany({ where: { createdById: params.id } }),
    prisma.inviteCode.updateMany({
      where: { usedById: params.id },
      data: { usedById: null },
    }),
    prisma.user.delete({ where: { id: params.id } }),
  ]);

  // 事务成功后尽力清理附件文件/目录 + 头像文件，失败不阻塞接口
  const uploadDir = process.env.UPLOAD_DIR || "./uploads";
  for (const rel of attachmentPaths) {
    try {
      await fs.unlink(path.resolve(uploadDir, rel));
    } catch {
      // 文件可能已缺失，继续
    }
  }
  for (const noteId of noteIds) {
    try {
      await fs.rm(path.resolve(uploadDir, "notes", noteId), {
        recursive: true,
        force: true,
      });
    } catch {
      // 目录可能不存在，继续
    }
  }
  if (target.avatarStoragePath) {
    try {
      await fs.unlink(path.resolve(uploadDir, target.avatarStoragePath));
    } catch {
      // 文件可能已缺失，继续
    }
  }

  return NextResponse.json({
    ok: true,
    deletedUserId: params.id,
    counts: {
      notes: results[1].count,
      attachments: results[0].count,
      feedbackTickets: results[2].count,
      announcementReads: results[3].count,
      passwordResetTokens: results[4].count,
      createdInvites: results[5].count,
    },
  });
}
