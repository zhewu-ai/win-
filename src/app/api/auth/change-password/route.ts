import { NextResponse } from "next/server";
import { authOrResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MIN_PASSWORD_LENGTH } from "@/lib/admin";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await authOrResponse();
  if (session instanceof NextResponse) return session;

  let body: { currentPassword?: unknown; newPassword?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "INVALID_REQUEST" },
      { status: 400 }
    );
  }

  const { currentPassword, newPassword } = body;
  if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
    return NextResponse.json(
      { ok: false, error: "INVALID_REQUEST" },
      { status: 400 }
    );
  }

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      {
        ok: false,
        error: "PASSWORD_TOO_SHORT",
        message: `密码至少 ${MIN_PASSWORD_LENGTH} 位`,
      },
      { status: 400 }
    );
  }

  // 重新查数据库拿 passwordHash + 状态，不能只信 session（disabled 旧 session 也不能改）
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, status: true, passwordHash: true },
  });
  if (!user || user.status !== "active") {
    return NextResponse.json(
      {
        ok: false,
        error: "ACCOUNT_DISABLED",
        message: "账号已被禁用，请联系管理员",
      },
      { status: 403 }
    );
  }

  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    return NextResponse.json(
      { ok: false, error: "INVALID_CURRENT_PASSWORD", message: "当前密码不正确" },
      { status: 400 }
    );
  }

  // 重新 bcrypt hash 保存，明文绝不出现在响应/日志；改密成功后清除强制改密标记
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, mustChangePassword: false },
  });

  return NextResponse.json({ ok: true, message: "密码已修改" });
}
