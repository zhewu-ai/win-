import { NextResponse } from "next/server";
import { requireUser, toErrorResponse } from "@/lib/auth";
import { isProjectOwnedBy, quickWeekParse } from "@/lib/work-calendar";
import { isValidDateString } from "@/lib/calendar";

// 快速录入一周：只返回合并预览，不直接写入。用户确认后由前端逐条 POST 落库。

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

export async function POST(request: Request) {
  try {
    const user = await requireUser();

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ ok: false, error: "INVALID_REQUEST" }, { status: 400 });
    }

    const projectId = typeof body.projectId === "string" ? body.projectId : "";
    if (!projectId || !(await isProjectOwnedBy(user.id, projectId))) {
      return NextResponse.json({ ok: false, error: "INVALID_PROJECT" }, { status: 400 });
    }

    const weekStart = typeof body.weekStart === "string" ? body.weekStart : "";
    if (!isValidDateString(weekStart)) {
      return NextResponse.json({ ok: false, error: "INVALID_WEEK_START" }, { status: 400 });
    }

    const days: Record<string, string> = {};
    const rawDays = body.days && typeof body.days === "object" ? (body.days as Record<string, unknown>) : {};
    for (const key of DAY_KEYS) {
      const v = rawDays[key];
      days[key] = typeof v === "string" ? v : "";
    }

    let nodes: { date: string; title: string }[] = [];
    if (Array.isArray(body.nodes)) {
      nodes = (body.nodes as unknown[]).slice(0, 20).flatMap((n) => {
        if (!n || typeof n !== "object") return [];
        const o = n as Record<string, unknown>;
        if (typeof o.date !== "string" || typeof o.title !== "string") return [];
        return [{ date: o.date, title: o.title }];
      });
    }

    const preview = quickWeekParse(days, weekStart, nodes);

    if (preview.length === 0) {
      return NextResponse.json({ ok: false, error: "EMPTY_PREVIEW" }, { status: 400 });
    }

    return NextResponse.json({ ok: true, preview });
  } catch (e) {
    return toErrorResponse(e);
  }
}
