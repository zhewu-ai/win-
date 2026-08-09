import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

// M12 日历事件共享工具：路由层（GET 范围 / POST / PATCH / DELETE）共用的校验与序列化。

const EVENT_INCLUDE = {
  note: { select: { id: true, title: true, isArchived: true, deletedAt: true } },
} as const satisfies Prisma.CalendarEventInclude;

export type CalendarEventWithNote = Prisma.CalendarEventGetPayload<{
  include: typeof EVENT_INCLUDE;
}>;

export function isValidDateString(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
  );
}

export function isValidTimeString(s: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

const EVENT_STATUSES = ["todo", "done", "postponed"] as const;
export function isValidStatus(s: string): boolean {
  return (EVENT_STATUSES as readonly string[]).includes(s);
}

/** noteId 如提供，必须属于当前用户且未删除。 */
export async function isNoteOwnedBy(
  userId: string,
  noteId: string | null
): Promise<boolean> {
  if (noteId == null) return true;
  const note = await prisma.note.findFirst({
    where: { id: noteId, userId, deletedAt: null },
    select: { id: true },
  });
  return !!note;
}

export interface CalendarEventDTO {
  id: string;
  noteId: string | null;
  title: string;
  description: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  allDay: boolean;
  status: string;
  source: string;
  createdAt: string;
  updatedAt: string;
  note: {
    id: string;
    title: string;
    isArchived: boolean;
    isTrashed: boolean;
  } | null;
}

export function serializeEvent(e: CalendarEventWithNote): CalendarEventDTO {
  return {
    id: e.id,
    noteId: e.noteId,
    title: e.title,
    description: e.description,
    date: e.date,
    startTime: e.startTime,
    endTime: e.endTime,
    allDay: e.allDay,
    status: e.status,
    source: e.source,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
    note: e.note
      ? {
          id: e.note.id,
          title: e.note.title,
          isArchived: e.note.isArchived,
          isTrashed: !!e.note.deletedAt,
        }
      : null,
  };
}

export { EVENT_INCLUDE };
