"use client";

import { useMemo } from "react";
import type { CalendarEvent } from "@/types";
import { isSameDay, monthGrid, toDateStr, weekdayLabel } from "@/lib/calendar-date";
import EventChip from "./EventChip";

interface Props {
  monthDate: Date;
  events: CalendarEvent[];
  today: Date;
  onSelectDay: (dateStr: string) => void;
  onEventClick: (event: CalendarEvent) => void;
}

const MAX_CELL_EVENTS = 3;

export default function MonthView({ monthDate, events, today, onSelectDay, onEventClick }: Props) {
  const cells = useMemo(() => monthGrid(monthDate.getFullYear(), monthDate.getMonth()), [monthDate]);
  const byDate = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const arr = m.get(e.date);
      if (arr) arr.push(e);
      else m.set(e.date, [e]);
    }
    return m;
  }, [events]);

  return (
    <div className="flex flex-col">
      {/* 表头 */}
      <div className="grid grid-cols-7 border-b border-border-light">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className={`px-1 py-1.5 text-center text-xs font-medium ${
              i >= 5 ? "text-accent-pink" : "text-ink-muted"
            }`}
          >
            {weekdayLabel(i)}
          </div>
        ))}
      </div>

      {/* 网格 */}
      <div className="grid grid-cols-7">
        {cells.map(({ date, inMonth }, idx) => {
          const key = toDateStr(date);
          const dayEvents = byDate.get(key) ?? [];
          const isToday = isSameDay(date, today);
          return (
            <div
              key={idx}
              role="button"
              tabIndex={0}
              onClick={() => onSelectDay(key)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectDay(key);
                }
              }}
              className={`group flex flex-col min-h-[52px] sm:min-h-[84px] items-stretch border-b border-r border-border-light/60 px-1 pt-1 pb-1 text-left cursor-pointer transition-colors hover:bg-surface-hover ${
                !inMonth ? "bg-page-bg/40" : ""
              }`}
            >
              <span
                className={`mb-0.5 flex items-center justify-center self-start h-5 min-w-5 px-1 rounded-full text-xs ${
                  isToday
                    ? "bg-primary text-white font-bold"
                    : inMonth
                      ? "text-ink"
                      : "text-ink-muted/50"
                }`}
              >
                {date.getDate()}
              </span>

              {/* 桌面：事件小卡片（最多 3 条） */}
              <div className="hidden sm:flex flex-col gap-0.5 min-h-0">
                {dayEvents.slice(0, MAX_CELL_EVENTS).map((e) => (
                  <EventChip key={e.id} event={e} onClick={() => onEventClick(e)} />
                ))}
                {dayEvents.length > MAX_CELL_EVENTS && (
                  <span className="px-1 text-[10px] text-ink-muted">
                    +{dayEvents.length - MAX_CELL_EVENTS}
                  </span>
                )}
              </div>

              {/* 窄窗口：日期 + 事件圆点，不塞文字避免重叠 */}
              <div className="sm:hidden flex items-center gap-0.5 mt-0.5 flex-wrap">
                {dayEvents.length > 0 && (
                  <>
                    {dayEvents.slice(0, 3).map((e) => (
                      <span
                        key={e.id}
                        className={`h-1.5 w-1.5 rounded-full ${
                          e.status === "done" ? "bg-ink-muted/40" : "bg-primary"
                        }`}
                      />
                    ))}
                    {dayEvents.length > 3 && (
                      <span className="text-[9px] text-ink-muted">+{dayEvents.length - 3}</span>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
