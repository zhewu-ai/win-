import { NextResponse } from "next/server";
import { requireAdmin, toErrorResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ADMIN_USER_SELECT } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
  } catch (e) {
    return toErrorResponse(e);
  }
  const users = await prisma.user.findMany({
    select: ADMIN_USER_SELECT,
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ ok: true, users });
}
