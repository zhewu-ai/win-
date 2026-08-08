import { NextResponse } from "next/server";
import { requireAdmin, toErrorResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ADMIN_USER_SELECT, MAX_QUOTA_BYTES, MIN_QUOTA_BYTES } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await requireAdmin();
  } catch (e) {
    return toErrorResponse(e);
  }

  let body: { storageQuotaBytes?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "INVALID_REQUEST" },
      { status: 400 }
    );
  }

  const quota = body.storageQuotaBytes;
  if (typeof quota !== "number" || !Number.isInteger(quota) || quota <= 0) {
    return NextResponse.json(
      { ok: false, error: "INVALID_QUOTA" },
      { status: 400 }
    );
  }
  if (quota < MIN_QUOTA_BYTES) {
    return NextResponse.json(
      {
        ok: false,
        error: "QUOTA_TOO_SMALL",
        message: "额度不能低于 1 MB",
      },
      { status: 400 }
    );
  }
  if (quota > MAX_QUOTA_BYTES) {
    return NextResponse.json(
      {
        ok: false,
        error: "QUOTA_TOO_LARGE",
        message: "额度不能超过 500 MB",
      },
      { status: 400 }
    );
  }

  const target = await prisma.user.findUnique({
    where: { id: id },
    select: { id: true, storageUsedBytes: true },
  });
  if (!target) {
    return NextResponse.json(
      { ok: false, error: "USER_NOT_FOUND" },
      { status: 404 }
    );
  }

  // 额度不能低于已用空间，否则用户瞬间进入不可用状态
  if (quota < target.storageUsedBytes) {
    return NextResponse.json(
      {
        ok: false,
        error: "QUOTA_BELOW_USED",
        message: "新额度不能低于当前已用空间",
      },
      { status: 400 }
    );
  }

  const user = await prisma.user.update({
    where: { id: id },
    data: { storageQuotaBytes: quota },
    select: ADMIN_USER_SELECT,
  });

  return NextResponse.json({ ok: true, user });
}
