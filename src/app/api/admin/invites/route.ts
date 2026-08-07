import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, toErrorResponse } from "@/lib/auth";
import { generateInviteCode, hashInviteCode, DEFAULT_EXPIRES_DAYS } from "@/lib/invites";

export async function GET() {
  try {
    await requireAdmin();
    const invites = await prisma.inviteCode.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        expiresAt: true,
        usedAt: true,
        createdAt: true,
        usedBy: {
          select: { id: true, username: true, displayName: true, email: true },
        },
      },
    });
    return NextResponse.json({ ok: true, invites });
  } catch (e) {
    return toErrorResponse(e);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();

    let expiresInDays = DEFAULT_EXPIRES_DAYS;
    try {
      const body = await request.json();
      if (body.expiresInDays !== undefined) {
        if (
          typeof body.expiresInDays !== "number" ||
          !Number.isInteger(body.expiresInDays) ||
          body.expiresInDays < 1 ||
          body.expiresInDays > 30
        ) {
          return NextResponse.json(
            { ok: false, error: "INVALID_EXPIRES_DAYS" },
            { status: 400 }
          );
        }
        expiresInDays = body.expiresInDays;
      }
    } catch {
      // 无 body 或非法 body 视为默认 7 天
    }

    const code = generateInviteCode();
    const invite = await prisma.inviteCode.create({
      data: {
        codeHash: hashInviteCode(code),
        createdById: admin.id,
        status: "active",
        expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000),
      },
      select: { id: true, expiresAt: true },
    });

    return NextResponse.json({
      ok: true,
      invite: { id: invite.id, code, expiresAt: invite.expiresAt },
    });
  } catch (e) {
    return toErrorResponse(e);
  }
}
