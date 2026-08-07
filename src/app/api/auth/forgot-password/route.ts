import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateResetToken, hashResetToken, RESET_TOKEN_TTL_MS } from "@/lib/passwordReset";
import { sendMail, buildResetEmail, APP_BASE_URL } from "@/lib/mailer";
import { rateLimit } from "@/lib/rateLimit";

const GENERIC_MESSAGE = "如果该邮箱已注册，我们会发送密码重置邮件。";

export async function POST(request: Request) {
  let body: { email?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "INVALID_REQUEST" },
      { status: 400 }
    );
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  // 最小频控：同邮箱 1 次/分钟；同 IP 5 次/10 分钟
  if (!rateLimit(`forgot:email:${email}`, 1, 60_000)) {
    return NextResponse.json(
      { ok: false, error: "RATE_LIMITED" },
      { status: 429 }
    );
  }
  if (!rateLimit(`forgot:ip:${ip}`, 5, 600_000)) {
    return NextResponse.json(
      { ok: false, error: "RATE_LIMITED" },
      { status: 429 }
    );
  }

  // 无论邮箱是否存在统一返回通用文案，不暴露账号状态
  const user = email
    ? await prisma.user.findFirst({ where: { email }, select: { id: true, status: true } })
    : null;

  if (user && user.status === "active") {
    const token = generateResetToken();
    const tokenHash = hashResetToken(token);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + RESET_TOKEN_TTL_MS);

    try {
      // 作废旧 token，只保留最新
      await prisma.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: now },
      });
      await prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash, expiresAt },
      });

      const resetLink = `${APP_BASE_URL}/reset-password?token=${encodeURIComponent(token)}`;
      const result = await sendMail(buildResetEmail(email, resetLink));
      if (!result.ok) {
        // 邮件发送失败不崩溃、不返回错误详情，服务端记录原因（不含 token）
        console.error("[forgot-password] mail send failed:", result.reason);
      }
    } catch (e) {
      // token 生成/落库/发送任何一步失败都不向用户暴露
      console.error("[forgot-password] error:", e instanceof Error ? e.message : "unknown");
    }
  }

  return NextResponse.json({ ok: true, message: GENERIC_MESSAGE });
}
