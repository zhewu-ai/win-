"use client";

import { useMemo } from "react";
import type { CalendarEvent } from "@/types";
import { addDays, isSameDay, toDateStr, weekdayLabel } from "@/lib/calendar-date";
import EventChip from "./EventChip";

interface Props {
  weekStart: Date;
  events: CalendarEvent[];
  today: Date;
  onSelectDay: (dateStr: string) => void;
  onEventClick: (event: CalendarEvent) => void;
}

function sortDayEvents(a: CalendarEvent, b: CalendarEvent): number {
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
  if (!a.startTime && !b.startTime) return a.createdAt < b.createdAt ? -1 : 1;
  if (!a.startTime) return 1;
  if (!b.startTime) return -1;
  return a.startTime < b.startTime ? -1 : 1;
}

export default function WeekView({ weekStart, events, today, onSelectDay, onEventClick }: Props) {
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const byDate = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const arr = m.get(e.date);
      if (arr) arr.push(e);
      else m.set(e.date, [e]);
    }
    for (const arr of m.values()) arr.sort(sortDayEvents);
    return m;
  }, [events]);

  // 桌面：7 列；窄窗口：切换为纵向 7 天列表，避免 7 列挤压重叠
  return (
    <div>
      {/* 桌面 7 列 */}
      <div className="hidden sm:grid sm:grid-cols-7 sm:border-b sm:border-border-light">
        {days.map((d) => {
          const key = toDateStr(d);
          const dayEvents = byDate.get(key) ?? [];
          const isToday = isSameDay(d, today);
          return (
            <div key={key} className="flex flex-col min-h-[120px] border-r border-border-light/60 last:border-r-0">
              <button
                type="button"
                onClick={() => onSelectDay(key)}
                className={`flex flex-col items-center py-1.5 border-b border-border-light/60 transition-colors hover:bg-surface-hover ${
                  isToday ? "bg-primary/5" : ""
                }`}
              >
                <span className={`text-xs ${isToday ? "text-primary font-bold" : "text-ink-muted"}`}>
                  周{weekdayLabel(d.getDay() === 0 ? 6 : d.getDay() - 1)}
                </span>
                <span
                  className={`mt-0.5 h-6 w-6 flex items-center justify-center rounded-full text-sm ${
                    isToday ? "bg-primary text-white font-bold" : "text-ink"
                  }`}
                >
                  {d.getDate()}
                </span>
              </button>
              <div className="flex-1 flex flex-col gap-0.5 p-1">
                {dayEvents.length === 0 && (
                  <span className="text-[10px] text-ink-muted/50">无</span>
                )}
                {dayEvents.map((e) => (
                  <EventChip key={e.id} event={e} onClick={() => onEventClick(e)} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* 窄窗口：纵向列表 */}
      <div className="sm:hidden flex flex-col divide-y divide-border-light/60">
        {days.map((d) => {
          const key = toDateStr(d);
          const dayEvents = byDate.get(key) ?? [];
          const isToday = isSameDay(d, today);
          return (
            <div key={key}>
              <button
                type="button"
                onClick={() => onSelectDay(key)}
                className={`flex items-center gap-2 px-3 py-2 w-full text-left transition-colors hover:bg-surface-hover ${
                  isToday ? "bg-primary/5" : ""
                }`}
              >
                <span className="text-sm font-medium text-ink">
                  周{weekdayLabel(d.getDay() === 0 ? 6 : d.getDay() - 1)}
                </span>
                <span
                  className={`h-6 w-6 flex items-center justify-center rounded-full text-sm ${
                    isToday ? "bg-primary text-white font-bold" : "text-ink"
                  }`}
                >
                  {d.getDate()}
                </span>
                <span className="ml-auto text-xs text-ink-muted">{dayEvents.length} 项</span>
              </button>
              <div className="px-3 pb-2 flex flex-col gap-0.5">
                {dayEvents.length === 0 && <span className="text-xs text-ink-muted/50">无事件</span>}
                {dayEvents.map((e) => (
                  <EventChip key={e.id} event={e} onClick={() => onEventClick(e)} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
