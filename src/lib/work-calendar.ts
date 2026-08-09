import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { isValidDateString } from "./calendar";
import type { QuickWeekDayInput, QuickWeekNodeInput, QuickWeekPreviewRow } from "@/types";

// M12 工作日历人工闭环：work-projects / work-schedule-items 路由层共用的校验与序列化。

export const PROJECT_COLOR_KEYS = ["blue", "red", "green", "purple", "gray"] as const;
export const PROJECT_STATUSES = ["active", "archived"] as const;
export const ITEM_TYPES = ["range", "node"] as const;
export const ITEM_STATUSES = ["todo", "done", "postponed"] as const;

export function isValidProjectColor(s: string): boolean {
  return (PROJECT_COLOR_KEYS as readonly string[]).includes(s);
}

export function isValidProjectStatus(s: string): boolean {
  return (PROJECT_STATUSES as readonly string[]).includes(s);
}

export function isValidItemType(s: string): boolean {
  return (ITEM_TYPES as readonly string[]).includes(s);
}

export function isValidItemStatus(s: string): boolean {
  return (ITEM_STATUSES as readonly string[]).includes(s);
}

/** projectId 必须属于当前用户且未删除。 */
export async function isProjectOwnedBy(
  userId: string,
  projectId: string | null
): Promise<boolean> {
  if (projectId == null) return false;
  const p = await prisma.workProject.findFirst({
    where: { id: projectId, userId, deletedAt: null },
    select: { id: true },
  });
  return !!p;
}

const PROJECT_INCLUDE = {} as const satisfies Prisma.WorkProjectInclude;
const ITEM_INCLUDE = {
  note: { select: { id: true, title: true, isArchived: true, deletedAt: true } },
} as const satisfies Prisma.WorkScheduleItemInclude;

export type WorkProjectRow = Prisma.WorkProjectGetPayload<{
  include: typeof PROJECT_INCLUDE;
}>;
export type WorkScheduleItemRow = Prisma.WorkScheduleItemGetPayload<{
  include: typeof ITEM_INCLUDE;
}>;

export function serializeProject(p: WorkProjectRow) {
  return {
    id: p.id,
    name: p.name,
    colorKey: p.colorKey,
    status: p.status,
    startDate: p.startDate,
    endDate: p.endDate,
    description: p.description,
    source: p.source,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    archivedAt: p.archivedAt ? p.archivedAt.toISOString() : null,
  };
}

export function serializeItem(i: WorkScheduleItemRow) {
  return {
    id: i.id,
    projectId: i.projectId,
    title: i.title,
    type: i.type,
    startDate: i.startDate,
    endDate: i.endDate,
    status: i.status,
    noteId: i.noteId,
    source: i.source,
    createdAt: i.createdAt.toISOString(),
    updatedAt: i.updatedAt.toISOString(),
    note: i.note
      ? {
          id: i.note.id,
          title: i.note.title,
          isArchived: i.note.isArchived,
          isTrashed: !!i.note.deletedAt,
        }
      : null,
  };
}

export { PROJECT_INCLUDE, ITEM_INCLUDE };

// quick-week：把「一周 7 天每行一句话 + 显式节点」合并成排期条目预览。
// 规则（SPEC §6.3）：
//   1. 连续日期内文字完全相同 → 合并为一条 range。
//   2. 只有一天出现的内容 → 默认 node 或单日 range，按关键词倾向。
//   3. 含「修改/制作/优化/调整/渲染/合成」→ 倾向 range。
//   4. 含「call/会议/提交/反馈/确认/交付/收付/输出/检查」→ 倾向 node。

const RANGE_KEYWORDS = ["修改", "制作", "优化", "调整", "渲染", "合成"];
const NODE_KEYWORDS = ["call", "会议", "提交", "反馈", "确认", "交付", "收付", "输出", "检查"];

function defaultTypeFor(text: string): "range" | "node" {
  const t = text.toLowerCase();
  if (RANGE_KEYWORDS.some((k) => t.includes(k))) return "range";
  if (NODE_KEYWORDS.some((k) => t.includes(k))) return "node";
  return "node";
}

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

/** weekStart 必须是周一的 YYYY-MM-DD。 */
export function quickWeekParse(
  days: QuickWeekDayInput,
  weekStart: string,
  nodes: QuickWeekNodeInput[]
): QuickWeekPreviewRow[] {
  const dayRows: { date: string; text: string }[] = [];
  DAY_KEYS.forEach((key, i) => {
    const text = (days[key] ?? "").trim();
    if (text) {
      const date = new Date(weekStart + "T12:00:00");
      date.setDate(date.getDate() + i);
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const d = String(date.getDate()).padStart(2, "0");
      dayRows.push({ date: `${y}-${m}-${d}`, text });
    }
  });

  const preview: QuickWeekPreviewRow[] = [];
  let i = 0;
  while (i < dayRows.length) {
    const cur = dayRows[i];
    let j = i;
    while (j + 1 < dayRows.length && dayRows[j + 1].text === cur.text) j++;
    const span = j - i + 1;
    const type = span > 1 ? "range" : defaultTypeFor(cur.text);
    preview.push({
      title: cur.text,
      type,
      startDate: dayRows[i].date,
      endDate: dayRows[j].date,
    });
    i = j + 1;
  }

  for (const n of nodes) {
    const title = (n.title ?? "").trim();
    const date = n.date;
    if (!title || !isValidDateString(date)) continue;
    preview.push({ title, type: "node", startDate: date, endDate: date });
  }

  return preview;
}
