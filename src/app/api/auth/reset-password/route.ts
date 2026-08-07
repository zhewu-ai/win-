import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashResetToken } from "@/lib/passwordReset";
import bcrypt from "bcryptjs";

const MIN_PASSWORD_LENGTH = 8;

class ResetError extends Error {
  constructor(
    public code: string,
    public status: number
  ) {
    super(code);
  }
}

export async function POST(request: Request) {
  try {
    let body: { token?: unknown; newPassword?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: "INVALID_REQUEST" },
        { status: 400 }
      );
    }

    const token = typeof body.token === "string" ? body.token : "";
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

    if (!token) {
      return NextResponse.json(
        { ok: false, error: "INVALID_RESET_TOKEN" },
        { status: 400 }
      );
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { ok: false, error: "PASSWORD_TOO_SHORT" },
        { status: 400 }
      );
    }

    const tokenHash = hashResetToken(token);
    const now = new Date();
    // bcrypt 较重，放在事务外算好，缩短持锁时间
    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.$transaction(async (tx) => {
      // 原子抢占：仅当 token 未使用且未过期时才置 usedAt，防 TOCTOU 并发二次使用
      const claim = await tx.passwordResetToken.updateMany({
        where: { tokenHash, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (claim.count !== 1) {
        const record = await tx.passwordResetToken.findUnique({
          where: { tokenHash },
          select: { usedAt: true, expiresAt: true },
        });
        if (!record) throw new ResetError("INVALID_RESET_TOKEN", 400);
        if (record.usedAt) throw new ResetError("RESET_TOKEN_USED", 400);
        throw new ResetError("RESET_TOKEN_EXPIRED", 400);
      }

      const record = await tx.passwordResetToken.findUnique({
        where: { tokenHash },
        select: { userId: true },
      });
      if (!record) throw new ResetError("INVALID_RESET_TOKEN", 400);

      const user = await tx.user.findUnique({
        where: { id: record.userId },
        select: { id: true, status: true },
      });
      if (!user || user.status !== "active") {
        throw new ResetError("ACCOUNT_DISABLED", 403);
      }

      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash },
      });

      // 清理该用户其它未使用 token
      await tx.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: now },
      });
    });

    // 不自动登录，要求重新登录
    return NextResponse.json({
      ok: true,
      message: "密码已重置，请重新登录。",
    });
  } catch (err) {
    if (err instanceof ResetError) {
      return NextResponse.json(
        { ok: false, error: err.code },
        { status: err.status }
      );
    }
    return NextResponse.json(
      { ok: false, error: "RESET_FAILED" },
      { status: 500 }
    );
  }
}
