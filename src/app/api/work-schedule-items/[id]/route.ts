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

// 排期条目单条：仅管理员；只能操作自己的未删除条目。

async function findOwnedItem(userId: string, id: string) {
  return prisma.workScheduleItem.findFirst({
    where: { id, userId, deletedAt: null, project: { deletedAt: null } },
    include: ITEM_INCLUDE,
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const existing = await findOwnedItem(user.id, id);
    if (!existing) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ ok: false, error: "INVALID_REQUEST" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};

    if (body.projectId !== undefined) {
      if (typeof body.projectId !== "string" || !(await isProjectOwnedBy(user.id, body.projectId))) {
        return NextResponse.json({ ok: false, error: "INVALID_PROJECT" }, { status: 400 });
      }
      updateData.projectId = body.projectId;
    }

    if (body.title !== undefined) {
      const title = typeof body.title === "string" ? body.title.trim() : "";
      if (!title || title.length > 120) {
        return NextResponse.json({ ok: false, error: "INVALID_TITLE" }, { status: 400 });
      }
      updateData.title = title;
    }

    if (body.type !== undefined) {
      if (typeof body.type !== "string" || !isValidItemType(body.type)) {
        return NextResponse.json({ ok: false, error: "INVALID_TYPE" }, { status: 400 });
      }
      updateData.type = body.type;
    }

    if (body.startDate !== undefined) {
      if (typeof body.startDate !== "string" || !isValidDateString(body.startDate)) {
        return NextResponse.json({ ok: false, error: "INVALID_DATE" }, { status: 400 });
      }
      updateData.startDate = body.startDate;
    }

    if (body.endDate !== undefined) {
      const endDate = body.endDate;
      if (typeof endDate !== "string" || !isValidDateString(endDate)) {
        return NextResponse.json({ ok: false, error: "INVALID_DATE" }, { status: 400 });
      }
      updateData.endDate = endDate;
    }

    if (body.status !== undefined) {
      if (typeof body.status !== "string" || !isValidItemStatus(body.status)) {
        return NextResponse.json({ ok: false, error: "INVALID_STATUS" }, { status: 400 });
      }
      updateData.status = body.status;
    }

    if (body.noteId !== undefined) {
      const noteId = body.noteId ?? null;
      if (noteId !== null && typeof noteId !== "string") {
        return NextResponse.json({ ok: false, error: "INVALID_NOTE" }, { status: 400 });
      }
      if (noteId !== null && !(await isNoteOwnedBy(user.id, noteId))) {
        return NextResponse.json({ ok: false, error: "INVALID_NOTE" }, { status: 400 });
      }
      updateData.noteId = noteId;
    }

    // 最终一致性校验：endDate 不能早于 startDate
    const finalStart = (updateData.startDate as string | undefined) ?? existing.startDate;
    const finalEnd = (updateData.endDate as string | undefined) ?? existing.endDate;
    if (finalEnd < finalStart) {
      return NextResponse.json({ ok: false, error: "INVALID_DATE_RANGE" }, { status: 400 });
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ ok: false, error: "NO_FIELDS_TO_UPDATE" }, { status: 400 });
    }

    const updated = await prisma.workScheduleItem.update({
      where: { id },
      data: updateData,
      include: ITEM_INCLUDE,
    });

    return NextResponse.json({ ok: true, item: serializeItem(updated) });
  } catch (e) {
    return toErrorResponse(e);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const existing = await findOwnedItem(user.id, id);
    if (!existing) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    await prisma.workScheduleItem.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return toErrorResponse(e);
  }
}
