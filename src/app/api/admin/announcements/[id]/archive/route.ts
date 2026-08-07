import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, toErrorResponse } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** 归档公告：published → archived（已归档不再展示给用户）。 */
export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin();

    const existing = await prisma.announcement.findUnique({
      where: { id: params.id },
      select: { id: true, status: true },
    });
    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "NOT_FOUND" },
        { status: 404 }
      );
    }
    if (existing.status === "archived") {
      return NextResponse.json({ ok: true, announcement: existing });
    }

    const announcement = await prisma.announcement.update({
      where: { id: params.id },
      data: { status: "archived" },
    });

    return NextResponse.json({ ok: true, announcement });
  } catch (e) {
    return toErrorResponse(e);
  }
}
