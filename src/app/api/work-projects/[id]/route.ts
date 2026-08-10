import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, toErrorResponse } from "@/lib/auth";
import {
  PROJECT_INCLUDE,
  isValidProjectColor,
  isValidProjectStatus,
  serializeProject,
} from "@/lib/work-calendar";
import { isValidDateString } from "@/lib/calendar";

// 工作日历项目单条：仅管理员；只能操作自己的未删除项目。

async function findOwnedProject(userId: string, id: string) {
  return prisma.workProject.findFirst({
    where: { id, userId, deletedAt: null },
    include: PROJECT_INCLUDE,
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const existing = await findOwnedProject(user.id, id);
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

    if (body.name !== undefined) {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name || name.length > 80) {
        return NextResponse.json({ ok: false, error: "INVALID_NAME" }, { status: 400 });
      }
      updateData.name = name;
    }

    if (body.colorKey !== undefined) {
      if (typeof body.colorKey !== "string" || !isValidProjectColor(body.colorKey)) {
        return NextResponse.json({ ok: false, error: "INVALID_COLOR" }, { status: 400 });
      }
      updateData.colorKey = body.colorKey;
    }

    for (const field of ["startDate", "endDate"] as const) {
      if (body[field] !== undefined) {
        const v = body[field];
        if (v !== null && (typeof v !== "string" || !isValidDateString(v))) {
          return NextResponse.json({ ok: false, error: "INVALID_DATE" }, { status: 400 });
        }
        updateData[field] = v;
      }
    }
    if (
      body.startDate &&
      body.endDate &&
      typeof body.startDate === "string" &&
      typeof body.endDate === "string" &&
      body.startDate > body.endDate
    ) {
      return NextResponse.json({ ok: false, error: "INVALID_DATE_RANGE" }, { status: 400 });
    }

    if (body.description !== undefined) {
      const description = typeof body.description === "string" ? body.description : "";
      if (description.length > 1000) {
        return NextResponse.json({ ok: false, error: "INVALID_DESCRIPTION" }, { status: 400 });
      }
      updateData.description = description;
    }

    // 归档/恢复：status 变化时同步 archivedAt
    if (body.status !== undefined) {
      if (typeof body.status !== "string" || !isValidProjectStatus(body.status)) {
        return NextResponse.json({ ok: false, error: "INVALID_STATUS" }, { status: 400 });
      }
      updateData.status = body.status;
      updateData.archivedAt = body.status === "archived" ? new Date() : null;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ ok: false, error: "NO_FIELDS_TO_UPDATE" }, { status: 400 });
    }

    const updated = await prisma.workProject.update({
      where: { id },
      data: updateData,
      include: PROJECT_INCLUDE,
    });

    return NextResponse.json({ ok: true, project: serializeProject(updated) });
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

    const existing = await findOwnedProject(user.id, id);
    if (!existing) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    // 软删项目（排期条目保留，避免历史月历记录被清空）
    await prisma.workProject.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return toErrorResponse(e);
  }
}
