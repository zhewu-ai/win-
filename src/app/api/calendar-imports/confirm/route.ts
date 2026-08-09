import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, toErrorResponse } from "@/lib/auth";
import { isValidProjectColor, ITEM_INCLUDE } from "@/lib/work-calendar";
import { isValidDateString } from "@/lib/calendar";
import type { CalendarImportDraft } from "@/types";

// M13 AI 排期导入：用户确认后把草稿写入正式日历。
// 仅在用户确认后调用；再次全量校验；创建缺失项目（同名 active 项目复用），
// 排期 type 由日期自动推导，source=ai_import。

const MAX_PROJECTS = 50;
const MAX_ITEMS = 200;

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();

    let body: { draft?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ ok: false, error: "INVALID_REQUEST" }, { status: 400 });
    }

    const draft = body.draft as CalendarImportDraft | undefined;
    if (!draft || typeof draft !== "object") {
      return NextResponse.json({ ok: false, error: "INVALID_DRAFT" }, { status: 400 });
    }
    const projects = Array.isArray(draft.projects) ? draft.projects.slice(0, MAX_PROJECTS) : [];
    const items = Array.isArray(draft.items) ? draft.items.slice(0, MAX_ITEMS) : [];

    // 2.5 项目名必填：空项目名且挂有排期 → 拒绝（避免静默丢弃）
    const emptyNameProject = projects.find((p) => {
      const name = typeof p.name === "string" ? p.name.trim() : "";
      return !name && !!p.tempId && items.some((it) => it.projectTempId === p.tempId);
    });
    if (emptyNameProject) {
      return NextResponse.json(
        { ok: false, error: "EMPTY_PROJECT_NAME", message: "请补充项目名后再导入。" },
        { status: 422 }
      );
    }

    return await prisma.$transaction(async (tx) => {
      // 1) 项目：校验 → 同名 active 复用，否则新建（缺失项目）
      const tempToReal = new Map<string, string>();
      const nameToReal = new Map<string, string>();
      const createdProjects = [];

      for (const p of projects) {
        const name = typeof p.name === "string" ? p.name.trim() : "";
        if (!name || name.length > 80) continue;
        if (!p.tempId) continue;

        let realId = nameToReal.get(name);
        if (!realId) {
          const existing = await tx.workProject.findFirst({
            where: { userId: admin.id, name, status: "active", deletedAt: null },
            select: { id: true },
          });
          realId = existing?.id;
          if (!realId) {
            const colorKey = isValidProjectColor(String(p.colorKey ?? "")) ? String(p.colorKey) : "blue";
            const created = await tx.workProject.create({
              data: { userId: admin.id, name, colorKey, source: "ai_import" },
            });
            realId = created.id;
            createdProjects.push(created);
          }
          nameToReal.set(name, realId);
        }
        tempToReal.set(p.tempId, realId);
      }

      // 2) 排期：校验 → 写入（type 由日期推导，source=ai_import）
      const createdItems = [];
      let skipped = 0;
      for (const it of items) {
        const title = typeof it.title === "string" ? it.title.trim() : "";
        const realProjectId = it.projectTempId ? tempToReal.get(it.projectTempId) : undefined;
        if (!title || title.length > 120 || !realProjectId) {
          skipped++;
          continue;
        }
        if (
          typeof it.startDate !== "string" ||
          !isValidDateString(it.startDate) ||
          typeof it.endDate !== "string" ||
          !isValidDateString(it.endDate) ||
          it.endDate < it.startDate
        ) {
          skipped++;
          continue;
        }
        const type = it.startDate === it.endDate ? "node" : "range";
        const created = await tx.workScheduleItem.create({
          data: {
            userId: admin.id,
            projectId: realProjectId,
            title,
            type,
            startDate: it.startDate,
            endDate: it.endDate,
            status: "todo",
            source: "ai_import",
          },
          include: ITEM_INCLUDE,
        });
        createdItems.push(created);
      }

      console.log(
        `[calendar-import] confirm ok projects=${createdProjects.length} items=${createdItems.length} skipped=${skipped}`
      );

      return NextResponse.json({
        ok: true,
        created: {
          projects: createdProjects.length,
          items: createdItems.length,
        },
        skipped,
      });
    });
  } catch (e) {
    console.error("[calendar-import] confirm failed", e);
    return toErrorResponse(e);
  }
}
