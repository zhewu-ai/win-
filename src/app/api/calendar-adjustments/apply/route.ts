import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, toErrorResponse } from "@/lib/auth";
import { isProjectOwnedBy } from "@/lib/work-calendar";
import { isValidDateString } from "@/lib/calendar";
import type { ScheduleAdjustmentApplyChange } from "@/types";

// M13 AI 自然语言调整排期：用户确认后按提交的变更写库（事务 + 逐条校验）。

const MAX_CHANGES = 100;

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

    const rawChanges = Array.isArray(body.changes) ? body.changes : [];
    if (rawChanges.length === 0) {
      return NextResponse.json({ ok: false, error: "EMPTY_CHANGES" }, { status: 400 });
    }
    if (rawChanges.length > MAX_CHANGES) {
      return NextResponse.json({ ok: false, error: "TOO_MANY_CHANGES" }, { status: 400 });
    }

    // 只接受用户确认后的 create/update；逐条校验字段。
    const validated: ScheduleAdjustmentApplyChange[] = [];
    for (const c of rawChanges) {
      if (!c || typeof c !== "object") {
        return NextResponse.json({ ok: false, error: "INVALID_CHANGE" }, { status: 400 });
      }
      const r = c as Record<string, unknown>;
      const type = r.type;
      if (type !== "create" && type !== "update") {
        return NextResponse.json({ ok: false, error: "INVALID_CHANGE" }, { status: 400 });
      }
      const title = typeof r.title === "string" ? r.title.trim() : "";
      if (!title || title.length > 120) {
        return NextResponse.json({ ok: false, error: "INVALID_TITLE" }, { status: 400 });
      }
      if (typeof r.startDate !== "string" || !isValidDateString(r.startDate)) {
        return NextResponse.json({ ok: false, error: "INVALID_DATE" }, { status: 400 });
      }
      const endDate = typeof r.endDate === "string" && r.endDate ? r.endDate : r.startDate;
      if (!isValidDateString(endDate) || endDate < r.startDate) {
        return NextResponse.json({ ok: false, error: "INVALID_DATE_RANGE" }, { status: 400 });
      }
      const reason = typeof r.reason === "string" ? r.reason.slice(0, 200) : "";
      if (type === "update") {
        const itemId = typeof r.itemId === "string" && r.itemId.trim() ? r.itemId.trim() : "";
        if (!itemId) {
          return NextResponse.json({ ok: false, error: "INVALID_ITEM" }, { status: 400 });
        }
        validated.push({ type: "update", projectId, itemId, title, startDate: r.startDate, endDate, reason });
      } else {
        validated.push({ type: "create", projectId, title, startDate: r.startDate, endDate, reason });
      }
    }

    // 写库前先校验所有 update 的 itemId 都属于该项目且未删除，避免中途失败。
    const updateIds = validated.filter((c) => c.type === "update").map((c) => c.itemId as string);
    if (updateIds.length > 0) {
      const found = await prisma.workScheduleItem.findMany({
        where: { id: { in: updateIds }, userId: admin.id, projectId, deletedAt: null },
        select: { id: true },
      });
      if (found.length !== updateIds.length) {
        return NextResponse.json({ ok: false, error: "ITEM_NOT_FOUND" }, { status: 400 });
      }
    }

    let applied = 0;
    try {
      await prisma.$transaction(async (tx) => {
        for (const ch of validated) {
          const type = ch.startDate === ch.endDate ? "node" : "range";
          if (ch.type === "create") {
            await tx.workScheduleItem.create({
              data: {
                userId: admin.id,
                projectId,
                title: ch.title,
                type,
                startDate: ch.startDate,
                endDate: ch.endDate,
                status: "todo",
                source: "ai_adjust",
              },
            });
          } else {
            await tx.workScheduleItem.update({
              where: { id: ch.itemId as string },
              data: { title: ch.title, type, startDate: ch.startDate, endDate: ch.endDate },
            });
          }
          applied++;
        }
      });
    } catch {
      return NextResponse.json({ ok: false, error: "APPLY_FAILED" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, applied });
  } catch (e) {
    return toErrorResponse(e);
  }
}
