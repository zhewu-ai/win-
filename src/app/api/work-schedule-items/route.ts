import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, toErrorResponse } from "@/lib/auth";
import {
  ITEM_INCLUDE,
  isValidItemType,
  isValidItemStatus,
  isProjectOwnedBy,
  serializeItem,
} from "@/lib/work-calendar";
import { isNoteOwnedBy, isValidDateString } from "@/lib/calendar";

// 排期条目：仅管理员；GET 必须带 from/to；POST 需所属项目属于当前用户。

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const projectId = searchParams.get("projectId");

    // 日期范围可选：省略 from/to 时返回全部非删条目（右栏项目全量 + 客户端切范围）。
    // 只给一个范围端点则仍按范围查询；二者都给了才校验顺序。
    const hasRange = Boolean(from || to);
    if (hasRange && (!from || !to || !isValidDateString(from) || !isValidDateString(to) || from > to)) {
      return NextResponse.json({ ok: false, error: "INVALID_DATE_RANGE" }, { status: 400 });
    }
    // 通过校验后 from/to 均非空
    const fromStr = from ?? "";
    const toStr = to ?? "";

    const items = await prisma.workScheduleItem.findMany({
      where: {
        userId: user.id,
        deletedAt: null,
        // 阻塞审计 P1：所属项目已删除的排期一律不返回（归档项目 deletedAt 为空，不受影响）。
        project: { deletedAt: null },
        ...(hasRange ? { startDate: { lte: toStr }, endDate: { gte: fromStr } } : {}),
        ...(projectId ? { projectId } : {}),
      },
      orderBy: [
        { startDate: "asc" },
        { type: "asc" },
        { createdAt: "asc" },
      ],
      include: ITEM_INCLUDE,
    });

    return NextResponse.json({ ok: true, items: items.map(serializeItem) });
  } catch (e) {
    return toErrorResponse(e);
  }
}

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

    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title || title.length > 120) {
      return NextResponse.json({ ok: false, error: "INVALID_TITLE" }, { status: 400 });
    }

    const type = typeof body.type === "string" ? body.type : "range";
    if (!isValidItemType(type)) {
      return NextResponse.json({ ok: false, error: "INVALID_TYPE" }, { status: 400 });
    }

    if (typeof body.startDate !== "string" || !isValidDateString(body.startDate)) {
      return NextResponse.json({ ok: false, error: "INVALID_DATE" }, { status: 400 });
    }

    // endDate：node 时默认等于 startDate；range 时必须提供且不早于 startDate
    let endDate = body.endDate;
    if (endDate === undefined || endDate === null || endDate === "") {
      endDate = body.startDate;
    }
    if (typeof endDate !== "string" || !isValidDateString(endDate) || endDate < body.startDate) {
      return NextResponse.json({ ok: false, error: "INVALID_DATE_RANGE" }, { status: 400 });
    }

    const status = typeof body.status === "string" ? body.status : "todo";
    if (!isValidItemStatus(status)) {
      return NextResponse.json({ ok: false, error: "INVALID_STATUS" }, { status: 400 });
    }

    const noteId = body.noteId ?? null;
    if (noteId !== null && typeof noteId !== "string") {
      return NextResponse.json({ ok: false, error: "INVALID_NOTE" }, { status: 400 });
    }
    if (noteId !== null && !(await isNoteOwnedBy(user.id, noteId))) {
      return NextResponse.json({ ok: false, error: "INVALID_NOTE" }, { status: 400 });
    }

    const created = await prisma.workScheduleItem.create({
      data: {
        userId: user.id,
        projectId,
        title,
        type,
        startDate: body.startDate,
        endDate,
        status,
        noteId,
      },
      include: ITEM_INCLUDE,
    });

    return NextResponse.json({ ok: true, item: serializeItem(created) }, { status: 201 });
  } catch (e) {
    return toErrorResponse(e);
  }
}
