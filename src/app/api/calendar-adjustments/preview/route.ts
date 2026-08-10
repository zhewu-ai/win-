import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, toErrorResponse } from "@/lib/auth";
import { isProjectOwnedBy } from "@/lib/work-calendar";
import { generateAdjustmentDraft } from "@/lib/schedule-adjust";
import { addDays, todayStr, toDateStr } from "@/lib/calendar-date";
import type { ScheduleAdjustmentContextItem } from "@/lib/schedule-adjust";

// M13 AI 自然语言调整排期：生成变更草稿（只读 AI，绝不写库）。

const MAX_INSTRUCTION_LEN = 500;
const MAX_RANGE_DAYS = 60;

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ ok: false, error: "INVALID_REQUEST" }, { status: 400 });
    }

    const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";
    if (!projectId || !(await isProjectOwnedBy(admin.id, projectId))) {
      return NextResponse.json({ ok: false, error: "INVALID_PROJECT" }, { status: 400 });
    }

    const instruction = typeof body.instruction === "string" ? body.instruction.trim() : "";
    if (!instruction) {
      return NextResponse.json({ ok: false, error: "EMPTY_INSTRUCTION" }, { status: 400 });
    }
    if (instruction.length > MAX_INSTRUCTION_LEN) {
      return NextResponse.json({ ok: false, error: "INSTRUCTION_TOO_LONG" }, { status: 400 });
    }

    const rangeDaysRaw = typeof body.rangeDays === "number" ? body.rangeDays : 30;
    const rangeDays =
      Number.isFinite(rangeDaysRaw) && rangeDaysRaw >= 7 && rangeDaysRaw <= MAX_RANGE_DAYS
        ? Math.floor(rangeDaysRaw)
        : 30;

    const project = await prisma.workProject.findFirst({
      where: { id: projectId, userId: admin.id, deletedAt: null },
      select: { name: true },
    });
    if (!project) {
      return NextResponse.json({ ok: false, error: "INVALID_PROJECT" }, { status: 400 });
    }

    const today = todayStr();
    const futureStart = today;
    const futureEnd = toDateStr(addDays(new Date(), rangeDays));
    const recentStart = toDateStr(addDays(new Date(), -7));

    // 只取当前项目的必要排期上下文，不给全量数据。
    const [futureRows, recentRows] = await Promise.all([
      prisma.workScheduleItem.findMany({
        where: { userId: admin.id, projectId, deletedAt: null, startDate: { lte: futureEnd }, endDate: { gte: futureStart } },
        orderBy: [{ startDate: "asc" }, { createdAt: "asc" }],
        select: { id: true, title: true, type: true, startDate: true, endDate: true, status: true },
      }),
      prisma.workScheduleItem.findMany({
        where: { userId: admin.id, projectId, deletedAt: null, startDate: { gte: recentStart, lte: today } },
        orderBy: [{ startDate: "asc" }, { createdAt: "asc" }],
        select: { id: true, title: true, type: true, startDate: true, endDate: true, status: true },
      }),
    ]);

    const toCtx = (rows: typeof futureRows): ScheduleAdjustmentContextItem[] =>
      rows.map((r) => ({
        id: r.id,
        title: r.title,
        type: r.type as ScheduleAdjustmentContextItem["type"],
        startDate: r.startDate,
        endDate: r.endDate,
        status: r.status as ScheduleAdjustmentContextItem["status"],
      }));

    const { draft, usage } = await generateAdjustmentDraft({
      projectId,
      projectName: project.name,
      instruction,
      futureItems: toCtx(futureRows),
      recentItems: toCtx(recentRows),
    });

    return NextResponse.json({ ok: true, draft, usage });
  } catch (e) {
    return toErrorResponse(e);
  }
}
