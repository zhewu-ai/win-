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

// 工作日历项目：所有已登录用户可用；未登录 401、禁用 403；只能访问自己的数据。
// GET 默认只返回 active（status=archived 时仅归档），?status=all 返回全部未删除。

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const projects = await prisma.workProject.findMany({
      where: {
        userId: user.id,
        deletedAt: null,
        ...(status === "all" ? {} : { status: "active" }),
      },
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
      include: PROJECT_INCLUDE,
    });

    return NextResponse.json({ ok: true, projects: projects.map(serializeProject) });
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

    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 80) {
      return NextResponse.json({ ok: false, error: "INVALID_NAME" }, { status: 400 });
    }

    const colorKey = typeof body.colorKey === "string" ? body.colorKey : "blue";
    if (!isValidProjectColor(colorKey)) {
      return NextResponse.json({ ok: false, error: "INVALID_COLOR" }, { status: 400 });
    }

    const optionalDate = (v: unknown): string | null | "INVALID" => {
      if (v === undefined || v === null || v === "") return null;
      if (typeof v === "string" && isValidDateString(v)) return v;
      return "INVALID";
    };
    const startDate = optionalDate(body.startDate);
    const endDate = optionalDate(body.endDate);
    if (startDate === "INVALID" || endDate === "INVALID") {
      return NextResponse.json({ ok: false, error: "INVALID_DATE" }, { status: 400 });
    }
    if (startDate && endDate && startDate > endDate) {
      return NextResponse.json({ ok: false, error: "INVALID_DATE_RANGE" }, { status: 400 });
    }

    const description = typeof body.description === "string" ? body.description : "";
    if (description.length > 1000) {
      return NextResponse.json({ ok: false, error: "INVALID_DESCRIPTION" }, { status: 400 });
    }

    const created = await prisma.workProject.create({
      data: {
        userId: user.id,
        name,
        colorKey,
        startDate,
        endDate,
        description,
      },
      include: PROJECT_INCLUDE,
    });

    return NextResponse.json({ ok: true, project: serializeProject(created) }, { status: 201 });
  } catch (e) {
    return toErrorResponse(e);
  }
}
