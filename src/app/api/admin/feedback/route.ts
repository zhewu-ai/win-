import { NextResponse } from "next/server";
import { requireAdmin, toErrorResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const VALID_TYPES = ["bug", "feature", "other"];
const VALID_STATUSES = ["open", "reviewing", "resolved", "closed"];

export async function GET(request: Request) {
  try {
    await requireAdmin();
  } catch (e) {
    return toErrorResponse(e);
  }

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const type = url.searchParams.get("type");

  const where: Record<string, string> = {};
  if (status && VALID_STATUSES.includes(status)) where.status = status;
  if (type && VALID_TYPES.includes(type)) where.type = type;

  const [tickets, openCount] = await Promise.all([
    prisma.feedbackTicket.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        type: true,
        title: true,
        content: true,
        status: true,
        pageUrl: true,
        userAgent: true,
        appVersion: true,
        adminNote: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            displayName: true,
          },
        },
      },
    }),
    prisma.feedbackTicket.count({ where: { status: "open" } }),
  ]);

  return NextResponse.json({ ok: true, tickets, openCount });
}
