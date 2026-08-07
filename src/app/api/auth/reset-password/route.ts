import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashResetToken } from "@/lib/passwordReset";
import bcrypt from "bcryptjs";

const MIN_PASSWORD_LENGTH = 8;

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
    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      select: { userId: true, usedAt: true, expiresAt: true },
    });

    if (!record) {
      return NextResponse.json(
        { ok: false, error: "INVALID_RESET_TOKEN" },
        { status: 400 }
      );
    }
    if (record.usedAt) {
      return NextResponse.json(
        { ok: false, error: "RESET_TOKEN_USED" },
        { status: 400 }
      );
    }
    if (record.expiresAt <= new Date()) {
      return NextResponse.json(
        { ok: false, error: "RESET_TOKEN_EXPIRED" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: record.userId },
      select: { id: true, status: true },
    });
    if (!user || user.status !== "active") {
      return NextResponse.json(
        { ok: false, error: "ACCOUNT_DISABLED" },
        { status: 403 }
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    const now = new Date();

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      }),
      // 当前 token 一次性使用
      prisma.passwordResetToken.update({
        where: { tokenHash },
        data: { usedAt: now },
      }),
      // 清理该用户其它未使用 token
      prisma.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: now },
      }),
    ]);

    // 不自动登录，要求重新登录
    return NextResponse.json({
      ok: true,
      message: "密码已重置，请重新登录。",
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "RESET_FAILED" },
      { status: 500 }
    );
  }
}
