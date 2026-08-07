import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hashInviteCode } from "@/lib/invites";
import { createSampleNotes } from "@/lib/sample-notes";
import bcrypt from "bcryptjs";

const MIN_PASSWORD_LENGTH = 8;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_QUOTA_BYTES = 10485760;

class RegisterError extends Error {
  code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export async function POST(request: Request) {
  try {
    let body: { email?: unknown; password?: unknown; inviteCode?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: "INVALID_REQUEST" },
        { status: 400 }
      );
    }

    const emailRaw = typeof body.email === "string" ? body.email : "";
    const password = typeof body.password === "string" ? body.password : "";
    const inviteCodeRaw =
      typeof body.inviteCode === "string" ? body.inviteCode.trim() : "";

    // email 校验：格式 + 小写归一
    const email = normalizeEmail(emailRaw);
    if (!EMAIL_REGEX.test(email) || email.length > 254) {
      return NextResponse.json(
        { ok: false, error: "INVALID_EMAIL" },
        { status: 400 }
      );
    }

    // 密码校验
    if (password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { ok: false, error: "PASSWORD_TOO_SHORT" },
        { status: 400 }
      );
    }

    // 邀请码必填
    if (!inviteCodeRaw) {
      return NextResponse.json(
        { ok: false, error: "INVALID_INVITE_CODE" },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { ok: false, error: "EMAIL_ALREADY_REGISTERED" },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const codeHash = hashInviteCode(inviteCodeRaw);
    const now = new Date();

    let user: { id: string } | null = null;
    let sampleBytes = 0;
    try {
      user = await prisma.$transaction(async (tx) => {
        const invite = await tx.inviteCode.findUnique({ where: { codeHash } });
        if (!invite) throw new RegisterError("INVALID_INVITE_CODE");
        if (invite.status === "revoked") throw new RegisterError("INVITE_REVOKED");
        if (invite.status === "used") throw new RegisterError("INVITE_USED");
        if (invite.status === "expired" || invite.expiresAt <= now) {
          throw new RegisterError("INVITE_EXPIRED");
        }

        const created = await tx.user.create({
          data: {
            username: email,
            email,
            passwordHash,
            displayName: email.split("@")[0] || null,
            role: "user",
            status: "active",
            storageQuotaBytes: DEFAULT_QUOTA_BYTES,
            storageUsedBytes: 0,
          },
          select: { id: true },
        });

        await tx.inviteCode.update({
          where: { id: invite.id },
          data: { status: "used", usedById: created.id, usedAt: now },
        });

        // 新用户示例便签：仅注册时生成一次，老用户不补发
        sampleBytes = await createSampleNotes(tx, created.id);
        if (sampleBytes > 0) {
          await tx.user.update({
            where: { id: created.id },
            data: { storageUsedBytes: { increment: sampleBytes } },
          });
        }

        return created;
      });
    } catch (e) {
      if (e instanceof RegisterError) {
        return NextResponse.json({ ok: false, error: e.code }, { status: 400 });
      }
      if (
        e instanceof Error &&
        "code" in e &&
        (e as { code?: string }).code === "P2002"
      ) {
        // email 唯一约束兜底（并发注册同邮箱）
        return NextResponse.json(
          { ok: false, error: "EMAIL_ALREADY_REGISTERED" },
          { status: 409 }
        );
      }
      throw e;
    }

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "REGISTER_FAILED" },
        { status: 500 }
      );
    }

    // 注册成功自动登录
    const session = await getSession();
    session.userId = user.id;
    await session.save();

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        email,
        username: email,
        displayName: email.split("@")[0] || null,
        role: "user",
        status: "active",
        storageQuotaBytes: DEFAULT_QUOTA_BYTES,
        storageUsedBytes: sampleBytes,
      },
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "REGISTER_FAILED" },
      { status: 500 }
    );
  }
}
