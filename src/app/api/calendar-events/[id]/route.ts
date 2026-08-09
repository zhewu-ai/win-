import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, toErrorResponse } from "@/lib/auth";
import {
  EVENT_INCLUDE,
  isNoteOwnedBy,
  isValidDateString,
  isValidStatus,
  isValidTimeString,
  serializeEvent,
} from "@/lib/calendar";

// 日历事件单条：仅管理员可访问；只能操作自己的未删除事件。

async function findOwnedEvent(userId: string, id: string) {
  return prisma.calendarEvent.findFirst({
    where: { id, userId, deletedAt: null },
    include: EVENT_INCLUDE,
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;

    const existing = await findOwnedEvent(admin.id, id);
    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "NOT_FOUND" },
        { status: 404 }
      );
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: "INVALID_REQUEST" },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};

    if (body.title !== undefined) {
      const title = typeof body.title === "string" ? body.title.trim() : "";
      if (!title || title.length > 120) {
        return NextResponse.json(
          { ok: false, error: "INVALID_TITLE" },
          { status: 400 }
        );
      }
      updateData.title = title;
    }

    if (body.description !== undefined) {
      const description =
        typeof body.description === "string" ? body.description : "";
      if (description.length > 1000) {
        return NextResponse.json(
          { ok: false, error: "INVALID_DESCRIPTION" },
          { status: 400 }
        );
      }
      updateData.description = description;
    }

    if (body.date !== undefined) {
      if (typeof body.date !== "string" || !isValidDateString(body.date)) {
        return NextResponse.json(
          { ok: false, error: "INVALID_DATE" },
          { status: 400 }
        );
      }
      updateData.date = body.date;
    }

    if (body.allDay !== undefined) {
      if (typeof body.allDay !== "boolean") {
        return NextResponse.json(
          { ok: false, error: "INVALID_ALL_DAY" },
          { status: 400 }
        );
      }
      updateData.allDay = body.allDay;
    }

    for (const field of ["startTime", "endTime"] as const) {
      if (body[field] !== undefined) {
        const v = body[field];
        if (v !== null && (typeof v !== "string" || !isValidTimeString(v))) {
          return NextResponse.json(
            { ok: false, error: "INVALID_TIME" },
            { status: 400 }
          );
        }
        updateData[field] = v;
      }
    }

    if (body.status !== undefined) {
      if (typeof body.status !== "string" || !isValidStatus(body.status)) {
        return NextResponse.json(
          { ok: false, error: "INVALID_STATUS" },
          { status: 400 }
        );
      }
      updateData.status = body.status;
    }

    if (body.noteId !== undefined) {
      const noteId = body.noteId ?? null;
      if (noteId !== null && typeof noteId !== "string") {
        return NextResponse.json(
          { ok: false, error: "INVALID_NOTE" },
          { status: 400 }
        );
      }
      if (noteId !== null && !(await isNoteOwnedBy(admin.id, noteId))) {
        return NextResponse.json(
          { ok: false, error: "INVALID_NOTE" },
          { status: 400 }
        );
      }
      updateData.noteId = noteId;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { ok: false, error: "NO_FIELDS_TO_UPDATE" },
        { status: 400 }
      );
    }

    const updated = await prisma.calendarEvent.update({
      where: { id },
      data: updateData,
      include: EVENT_INCLUDE,
    });

    return NextResponse.json({ ok: true, event: serializeEvent(updated) });
  } catch (e) {
    return toErrorResponse(e);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;

    const existing = await findOwnedEvent(admin.id, id);
    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // 软删：设置 deletedAt，不删除关联便签。
    await prisma.calendarEvent.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return toErrorResponse(e);
  }
}
