"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import type { CalendarEvent, CalendarEventInput } from "@/types";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";
import {
  addDays,
  fromDateStr,
  isValidDateRange,
  monthOptions,
  startOfWeek,
  toDateStr,
  todayStr,
} from "@/lib/calendar-date";
import MonthView from "./MonthView";
import WeekView from "./WeekView";
import TodayList from "./TodayList";
import EventEditorDialog from "./EventEditorDialog";

type CalendarView = "month" | "week" | "day";

function rangeFor(view: CalendarView, monthDate: Date, weekStart: Date, dayDate: Date): { from: string; to: string } {
  if (view === "day") {
    const s = toDateStr(dayDate);
    return { from: s, to: s };
  }
  if (view === "week") {
    return { from: toDateStr(weekStart), to: toDateStr(addDays(weekStart, 6)) };
  }
  const y = monthDate.getFullYear();
  const m = monthDate.getMonth();
  return {
    from: toDateStr(new Date(y, m, 1)),
    to: toDateStr(new Date(y, m + 1, 0)),
  };
}

export default function CalendarPageClient() {
  const searchParams = useSearchParams();
  const [view, setView] = useState<CalendarView>("month");
  const [today, setToday] = useState<Date>(() => new Date());
  const [monthDate, setMonthDate] = useState<Date>(() => new Date());
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const [dayDate, setDayDate] = useState<Date>(() => new Date());
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [editorDate, setEditorDate] = useState<string>(todayStr());
  const [pendingEventId, setPendingEventId] = useState<string | null>(null);

  const { events, loading, error, fetchRange, createEvent, updateEvent, deleteEvent } =
    useCalendarEvents();

  const range = useMemo(() => rangeFor(view, monthDate, weekStart, dayDate), [view, monthDate, weekStart, dayDate]);

  useEffect(() => {
    void fetchRange(range.from, range.to);
  }, [fetchRange, range.from, range.to]);

  // 首页今日条/快速新建 → /calendar?date=YYYY-MM-DD&new=1 时打开新建弹窗；
  // /calendar?event=<id> 时等列表加载后打开该事件编辑弹窗（首页今日条无便签事件点击）。
  useEffect(() => {
    const date = searchParams.get("date");
    const eid = searchParams.get("event");
    if (searchParams.get("new") === "1" && date && isValidDateRange(date, date)) {
      setDayDate(fromDateStr(date));
      setEditorDate(date);
      setEditingEvent(null);
      setEditorOpen(true);
    } else if (eid) {
      setPendingEventId(eid);
    }
    // 仅在首次进入时读取
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!pendingEventId) return;
    const found = events.find((e) => e.id === pendingEventId);
    if (found) {
      setEditingEvent(found);
      setEditorDate(found.date);
      setEditorOpen(true);
      setPendingEventId(null);
    }
  }, [events, pendingEventId]);

  const goToToday = useCallback(() => {
    const t = new Date();
    setToday(t);
    setMonthDate(t);
    setWeekStart(startOfWeek(t));
    setDayDate(t);
  }, []);

  const navigate = useCallback(
    (dir: -1 | 1) => {
      if (view === "month") {
        setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() + dir, 1));
      } else if (view === "week") {
        setWeekStart((d) => addDays(d, dir * 7));
      } else {
        setDayDate((d) => addDays(d, dir));
      }
    },
    [view]
  );

  const handleSelectDay = useCallback((dateStr: string) => {
    setView("day");
    setDayDate(fromDateStr(dateStr));
  }, []);

  const handleEventClick = useCallback((e: CalendarEvent) => {
    setEditingEvent(e);
    setEditorDate(e.date);
    setEditorOpen(true);
  }, []);

  const handleNewEvent = useCallback((dateStr: string) => {
    setEditingEvent(null);
    setEditorDate(dateStr);
    setEditorOpen(true);
  }, []);

  const handleToggleDone = useCallback(
    (e: CalendarEvent) => {
      void updateEvent(e.id, { status: e.status === "done" ? "todo" : "done" }).catch(() => {});
    },
    [updateEvent]
  );

  const handleSave = useCallback(
    async (input: CalendarEventInput) => {
      if (editingEvent) await updateEvent(editingEvent.id, input);
      else await createEvent(input);
    },
    [editingEvent, updateEvent, createEvent]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteEvent(id);
    },
    [deleteEvent]
  );

  const monthLabel = `${monthDate.getFullYear()} 年 ${monthDate.getMonth() + 1} 月`;
  const monthSelectOptions = useMemo(() => monthOptions(monthDate), [monthDate]);

  return (
    <div className="h-screen flex flex-col bg-page-bg">
      {/* 顶栏 */}
      <header className="flex items-center gap-2 px-3 py-2 border-b border-border-light bg-sidebar-bg flex-shrink-0 flex-wrap">
        <Link
          href="/"
          className="flex items-center gap-1 text-sm text-ink-muted hover:text-ink transition-colors whitespace-nowrap"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          返回便签
        </Link>
        <h1 className="text-base font-bold text-ink whitespace-nowrap">工作日历</h1>

        <div className="mx-1 h-4 w-px bg-border-light" />

        {/* 视图切换 */}
        <div className="flex rounded-btn border border-border-light overflow-hidden">
          {(
            [
              ["month", "月"],
              ["week", "周"],
              ["day", "今日"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-2.5 py-1 text-sm transition-colors ${
                view === v ? "bg-primary text-white font-semibold" : "text-ink-muted hover:bg-surface-hover hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* 导航 */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => navigate(-1)}
            className="w-7 h-7 flex items-center justify-center rounded-btn text-ink-muted hover:text-ink hover:bg-surface-hover transition-colors"
            aria-label="上一页"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={() => navigate(1)}
            className="w-7 h-7 flex items-center justify-center rounded-btn text-ink-muted hover:text-ink hover:bg-surface-hover transition-colors"
            aria-label="下一页"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button
            onClick={goToToday}
            className="px-2 py-1 text-sm text-ink-muted hover:text-ink hover:bg-surface-hover rounded-btn transition-colors"
          >
            今天
          </button>
        </div>

        {/* 月份/周选择器 */}
        <div className="flex-1 min-w-0" />
        <span className="text-sm font-medium text-ink hidden sm:block">{monthLabel}</span>
        {view === "month" && (
          <select
            value={`${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`}
            onChange={(e) => {
              const [y, m] = e.target.value.split("-").map(Number);
              setMonthDate(new Date(y, m - 1, 1));
            }}
            className="px-2 py-1 text-sm text-ink bg-panel-bg border border-border-light rounded-input outline-none"
            aria-label="选择月份"
          >
            {monthSelectOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        )}
        {view === "week" && (
          <span className="text-sm text-ink-muted hidden sm:block">
            {`${monthDate.getFullYear()} 年 ${monthDate.getMonth() + 1} 月`}
          </span>
        )}
      </header>

      {/* 主体 */}
      <main className="flex-1 min-h-0 overflow-y-auto px-2 sm:px-4 py-3">
        {error && (
          <div className="mb-3 px-3 py-2 rounded-card bg-danger/10 text-sm text-danger">{error}</div>
        )}

        {loading && (
          <div className="mb-2 text-xs text-ink-muted">加载中...</div>
        )}

        <div className="max-w-5xl mx-auto">
          {view === "month" && (
            <MonthView
              monthDate={monthDate}
              events={events}
              today={today}
              onSelectDay={handleSelectDay}
              onEventClick={handleEventClick}
            />
          )}
          {view === "week" && (
            <WeekView
              weekStart={weekStart}
              events={events}
              today={today}
              onSelectDay={handleSelectDay}
              onEventClick={handleEventClick}
            />
          )}
          {view === "day" && (
            <TodayList
              date={dayDate}
              events={events.filter((e) => e.date === toDateStr(dayDate))}
              isToday={toDateStr(dayDate) === toDateStr(today)}
              onEventClick={handleEventClick}
              onToggleDone={handleToggleDone}
              onNewEvent={handleNewEvent}
            />
          )}
        </div>
      </main>

      <EventEditorDialog
        open={editorOpen}
        event={editingEvent}
        defaultDate={editorDate}
        onClose={() => setEditorOpen(false)}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </div>
  );
}
