"use client";

import type { CalendarEvent } from "@/types";
import { friendlyTime } from "@/lib/calendar-date";

interface Props {
  event: CalendarEvent;
  onClick: () => void;
  /** 紧凑模式：只显示标题，时间单独一行由调用方处理。 */
  compact?: boolean;
}

export function eventTimeLabel(e: CalendarEvent): string {
  if (e.allDay) return "";
  if (!e.startTime) return "";
  if (!e.endTime) return friendlyTime(e.startTime);
  return `${friendlyTime(e.startTime)}–${friendlyTime(e.endTime)}`;
}

function eventChipClass(e: CalendarEvent): string {
  if (e.status === "done") return "line-through opacity-50";
  if (e.status === "postponed") return "text-accent-pink";
  return "";
}

// 事件小卡片：月/周/日视图共用。点击打开编辑弹窗；done 划线、postponed 标色。
export default function EventChip({ event, onClick, compact }: Props) {
  const label = eventTimeLabel(event);
  return (
    <button
      type="button"
      onClick={(ev) => {
        ev.stopPropagation();
        onClick();
      }}
      title={event.title}
      className={`flex w-full items-center gap-1 text-left text-xs leading-tight rounded px-1.5 py-1 bg-primary/10 text-ink hover:bg-primary/20 transition-colors truncate ${eventChipClass(event)}`}
    >
      {label && !compact && (
        <span className="flex-shrink-0 text-[10px] text-ink-muted">{label}</span>
      )}
      <span className="flex-1 min-w-0 truncate">{event.title || "未命名事件"}</span>
      {event.note && (
        <svg className="w-3 h-3 flex-shrink-0 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )}
    </button>
  );
}
