import { NextResponse } from "next/server";
import { requireAdmin, toErrorResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ADMIN_USER_SELECT_WITH_COUNTS } from "@/lib/admin";
import { cstDayStartUTC } from "@/lib/activity";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
  } catch (e) {
    return toErrorResponse(e);
  }

  const [users, todayGroups, weekGroups] = await Promise.all([
    prisma.user.findMany({
      select: ADMIN_USER_SELECT_WITH_COUNTS,
      orderBy: { createdAt: "asc" },
    }),
    prisma.userActivityLog.groupBy({
      by: ["userId"],
      where: { createdAt: { gte: cstDayStartUTC() } },
      _count: { _all: true },
    }),
    prisma.userActivityLog.groupBy({
      by: ["userId"],
      where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      _count: { _all: true },
    }),
  ]);

  const todayCounts = new Map(
    todayGroups.map((g) => [g.userId, g._count._all])
  );
  const weekCounts = new Map(
    weekGroups.map((g) => [g.userId, g._count._all])
  );

  return NextResponse.json({
    ok: true,
    users: users.map((u) => ({
      ...u,
      activityCounts: {
        today: todayCounts.get(u.id) ?? 0,
        last7Days: weekCounts.get(u.id) ?? 0,
      },
    })),
  });
}
