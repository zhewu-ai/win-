import { NextResponse } from "next/server";
import { requireAdmin, toErrorResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MIN_PASSWORD_LENGTH } from "@/lib/admin";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin();
  } catch (e) {
    return toErrorResponse(e);
  }

  let body: { newPassword?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "INVALID_REQUEST" },
      { status: 400 }
    );
  }

  const newPassword = body.newPassword;
  if (typeof newPassword !== "string" || newPassword.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      {
        ok: false,
        error: "PASSWORD_TOO_SHORT",
        message: `密码至少 ${MIN_PASSWORD_LENGTH} 位`,
      },
      { status: 400 }
    );
  }

  const target = await prisma.user.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!target) {
    return NextResponse.json(
      { ok: false, error: "USER_NOT_FOUND" },
      { status: 404 }
    );
  }

  // 重新 bcrypt hash，绝不在响应/日志输出明文；重置密码后要求用户尽快修改
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: params.id },
    data: { passwordHash, mustChangePassword: true },
  });

  return NextResponse.json({ ok: true, message: "密码已重置" });
}
