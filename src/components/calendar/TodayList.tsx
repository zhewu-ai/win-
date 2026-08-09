"use client";

import { useMemo } from "react";
import type { CalendarEvent } from "@/types";
import { toDateStr, weekdayLabel } from "@/lib/calendar-date";
import { eventTimeLabel } from "./EventChip";

interface Props {
  date: Date;
  /** 已过滤到当前日期的全部事件。 */
  events: CalendarEvent[];
  isToday: boolean;
  onEventClick: (event: CalendarEvent) => void;
  onToggleDone: (event: CalendarEvent) => void;
  onNewEvent: (dateStr: string) => void;
}

function sortDayEvents(a: CalendarEvent, b: CalendarEvent): number {
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
  if (!a.startTime && !b.startTime) return a.createdAt < b.createdAt ? -1 : 1;
  if (!a.startTime) return 1;
  if (!b.startTime) return -1;
  return a.startTime < b.startTime ? -1 : 1;
}

const MONTH_NAMES = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];

export default function TodayList({ date, events, isToday, onEventClick, onToggleDone, onNewEvent }: Props) {
  const sorted = useMemo(() => [...events].sort(sortDayEvents), [events]);
  const dateStr = toDateStr(date);
  const dow = date.getDay();
  const weekday = `周${weekdayLabel(dow === 0 ? 6 : dow - 1)}`;
  const weekend = dow === 0 || dow === 6;

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 px-1 py-2">
        <h2 className="text-base font-bold text-ink">
          {MONTH_NAMES[date.getMonth()]} 月 {date.getDate()} 日
        </h2>
        <span className={`text-xs ${weekend ? "text-accent-pink" : "text-ink-muted"}`}>{weekday}</span>
        {isToday && (
          <span className="px-1.5 py-0.5 rounded-full bg-primary text-white text-[10px] font-bold">今天</span>
        )}
        <div className="flex-1" />
        <button
          onClick={() => onNewEvent(dateStr)}
          className="flex items-center gap-1 px-2.5 py-1 text-sm font-medium text-primary hover:bg-primary/10 rounded-btn transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m-7-7h14" />
          </svg>
          新建事件
        </button>
      </div>

      <div className="flex flex-col gap-1">
        {sorted.length === 0 && (
          <div className="px-3 py-6 text-center text-sm text-ink-muted">
            这一天没有事件
          </div>
        )}
        {sorted.map((e) => {
          const done = e.status === "done";
          return (
            <div
              key={e.id}
              className="flex items-start gap-2 px-2 py-1.5 rounded-btn hover:bg-surface-hover transition-colors group"
            >
              <button
                type="button"
                onClick={() => onToggleDone(e)}
                aria-label={done ? "标记为未完成" : "标记为完成"}
                className={`mt-0.5 flex-shrink-0 h-4 w-4 flex items-center justify-center rounded border transition-colors ${
                  done
                    ? "bg-primary border-primary text-white"
                    : "border-border-strong bg-panel-bg hover:border-primary/50"
                }`}
              >
                {done && (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
              <button
                type="button"
                onClick={() => onEventClick(e)}
                className="flex-1 min-w-0 text-left"
              >
                <span className={`block text-sm text-ink truncate ${done ? "line-through opacity-50" : ""}`}>
                  {e.title || "未命名事件"}
                </span>
                <span className="block text-xs text-ink-muted">
                  {e.allDay ? "全天" : eventTimeLabel(e)}
                  {e.note ? " · 已关联便签" : ""}
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
