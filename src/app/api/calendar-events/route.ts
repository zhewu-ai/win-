import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, toErrorResponse } from "@/lib/auth";
import {
  EVENT_INCLUDE,
  isNoteOwnedBy,
  isValidDateString,
  isValidTimeString,
  serializeEvent,
} from "@/lib/calendar";

// 日历事件：所有已登录用户可用；未登录 401、禁用 403。
// GET 范围接口必须带 from/to，避免一次拉全量。

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    if (
      !from ||
      !to ||
      !isValidDateString(from) ||
      !isValidDateString(to) ||
      from > to
    ) {
      return NextResponse.json(
        { ok: false, error: "INVALID_DATE_RANGE" },
        { status: 400 }
      );
    }

    const events = await prisma.calendarEvent.findMany({
      where: {
        userId: user.id,
        deletedAt: null,
        date: { gte: from, lte: to },
      },
      orderBy: [
        { date: "asc" },
        { allDay: "desc" },
        { startTime: "asc" },
        { createdAt: "asc" },
      ],
      include: EVENT_INCLUDE,
    });

    return NextResponse.json({ ok: true, events: events.map(serializeEvent) });
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
      return NextResponse.json(
        { ok: false, error: "INVALID_REQUEST" },
        { status: 400 }
      );
    }

    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title || title.length > 120) {
      return NextResponse.json(
        { ok: false, error: "INVALID_TITLE" },
        { status: 400 }
      );
    }

    const description = typeof body.description === "string" ? body.description : "";
    if (description.length > 1000) {
      return NextResponse.json(
        { ok: false, error: "INVALID_DESCRIPTION" },
        { status: 400 }
      );
    }

    if (typeof body.date !== "string" || !isValidDateString(body.date)) {
      return NextResponse.json(
        { ok: false, error: "INVALID_DATE" },
        { status: 400 }
      );
    }

    if (body.allDay !== undefined && typeof body.allDay !== "boolean") {
      return NextResponse.json(
        { ok: false, error: "INVALID_ALL_DAY" },
        { status: 400 }
      );
    }

    const startTime = body.startTime ?? null;
    const endTime = body.endTime ?? null;
    if (
      startTime !== null &&
      (typeof startTime !== "string" || !isValidTimeString(startTime))
    ) {
      return NextResponse.json(
        { ok: false, error: "INVALID_TIME" },
        { status: 400 }
      );
    }
    if (
      endTime !== null &&
      (typeof endTime !== "string" || !isValidTimeString(endTime))
    ) {
      return NextResponse.json(
        { ok: false, error: "INVALID_TIME" },
        { status: 400 }
      );
    }

    const noteId = body.noteId ?? null;
    if (noteId !== null && typeof noteId !== "string") {
      return NextResponse.json(
        { ok: false, error: "INVALID_NOTE" },
        { status: 400 }
      );
    }
    if (noteId !== null && !(await isNoteOwnedBy(user.id, noteId))) {
      return NextResponse.json(
        { ok: false, error: "INVALID_NOTE" },
        { status: 400 }
      );
    }

    const created = await prisma.calendarEvent.create({
      data: {
        userId: user.id,
        title,
        description,
        date: body.date,
        startTime,
        endTime,
        allDay: body.allDay === undefined ? true : body.allDay,
        status: "todo",
        noteId,
      },
      include: EVENT_INCLUDE,
    });

    return NextResponse.json(
      { ok: true, event: serializeEvent(created) },
      { status: 201 }
    );
  } catch (e) {
    return toErrorResponse(e);
  }
}
