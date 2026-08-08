import { NextResponse } from "next/server";
import { requireAdmin, toErrorResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ADMIN_USER_SELECT } from "@/lib/admin";

export const dynamic = "force-dynamic";

const VALID_STATUSES = ["active", "disabled"];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let admin;
  try {
    admin = await requireAdmin();
  } catch (e) {
    return toErrorResponse(e);
  }

  let body: { status?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "INVALID_REQUEST" },
      { status: 400 }
    );
  }

  const status = body.status;
  if (typeof status !== "string" || !VALID_STATUSES.includes(status)) {
    return NextResponse.json(
      { ok: false, error: "INVALID_STATUS" },
      { status: 400 }
    );
  }

  // 防止管理员禁用自己（把自己锁死）
  if (id === admin.id && status === "disabled") {
    return NextResponse.json(
      { ok: false, error: "CANNOT_DISABLE_SELF" },
      { status: 400 }
    );
  }

  const target = await prisma.user.findUnique({
    where: { id: id },
    select: { id: true },
  });
  if (!target) {
    return NextResponse.json(
      { ok: false, error: "USER_NOT_FOUND" },
      { status: 404 }
    );
  }

  const user = await prisma.user.update({
    where: { id: id },
    data: { status },
    select: ADMIN_USER_SELECT,
  });

  return NextResponse.json({ ok: true, user });
}
