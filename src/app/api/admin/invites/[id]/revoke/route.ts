import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, toErrorResponse } from "@/lib/auth";

export async function PATCH(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin();
    const id = params.id;

    const invite = await prisma.inviteCode.findUnique({ where: { id } });
    if (!invite) {
      return NextResponse.json(
        { ok: false, error: "INVITE_NOT_FOUND" },
        { status: 404 }
      );
    }

    if (invite.status === "used") {
      return NextResponse.json(
        { ok: false, error: "INVITE_USED", message: "已使用的邀请码不能作废" },
        { status: 400 }
      );
    }
    if (invite.status === "revoked") {
      return NextResponse.json(
        { ok: false, error: "INVITE_ALREADY_REVOKED" },
        { status: 400 }
      );
    }
    if (invite.status === "expired") {
      return NextResponse.json(
        { ok: false, error: "INVITE_EXPIRED", message: "邀请码已过期，无需作废" },
        { status: 400 }
      );
    }

    const updated = await prisma.inviteCode.update({
      where: { id },
      data: { status: "revoked" },
      select: { id: true, status: true },
    });
    return NextResponse.json({ ok: true, invite: updated });
  } catch (e) {
    return toErrorResponse(e);
  }
}
