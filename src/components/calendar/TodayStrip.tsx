"use client";

import { useEffect } from "react";
import type { CalendarEvent } from "@/types";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";
import { todayStr, weekdayLabel } from "@/lib/calendar-date";
import { eventTimeLabel } from "./EventChip";

interface Props {
  onOpenNote: (noteId: string) => void;
  /** 打开日历：传入目标路径，如 "/calendar"、"/calendar?date=...&new=1"、"/calendar?event=<id>"。 */
  onOpenCalendar: (path: string) => void;
}

const MONTH_NAMES = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];

// 首页顶部今日条（仅管理员展示）：今天日期 + 未完成数量 + 前 3 条事件 + 查看日历 + 快速新增。
// 窄窗口折叠为一行摘要。点击事件：有关联便签打开便签；否则去日历编辑该事件。
export default function TodayStrip({ onOpenNote, onOpenCalendar }: Props) {
  const { events, loading, fetchRange } = useCalendarEvents();

  useEffect(() => {
    const s = todayStr();
    void fetchRange(s, s);
    const onFocus = () => {
      void fetchRange(s, s);
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchRange]);

  const now = new Date();
  const dow = now.getDay();
  const dateLabel = `${MONTH_NAMES[now.getMonth()]} 月 ${now.getDate()} 日 · 周${weekdayLabel(
    dow === 0 ? 6 : dow - 1
  )}`;
  const undone = events.filter((e) => e.status !== "done");
  const first3 = events.slice(0, 3);
  const today = todayStr();

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border-light bg-panel-bg/60 flex-shrink-0 overflow-x-auto">
      <span className="flex items-center gap-1.5 text-sm text-ink whitespace-nowrap">
        <svg className="w-4 h-4 text-primary flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        {dateLabel}
      </span>
      {!loading && (
        <span className="text-xs text-ink-muted whitespace-nowrap">
          今日未完成 <span className="font-semibold text-primary">{undone.length}</span> 项
        </span>
      )}

      {/* 前 3 条事件（窄窗口隐藏） */}
      <div className="hidden sm:flex items-center gap-1.5 min-w-0 flex-1 overflow-x-auto">
        {loading && <span className="text-xs text-ink-muted">加载中...</span>}
        {!loading && first3.length === 0 && (
          <span className="text-xs text-ink-muted">今天没有事件</span>
        )}
        {first3.map((e: CalendarEvent) => (
          <button
            key={e.id}
            type="button"
            onClick={() =>
              e.noteId ? onOpenNote(e.noteId) : onOpenCalendar(`/calendar?event=${e.id}`)
            }
            title={e.title}
            className={`flex items-center gap-1 text-xs rounded px-1.5 py-0.5 bg-primary/10 hover:bg-primary/20 transition-colors truncate max-w-[160px] ${
              e.status === "done" ? "line-through opacity-50" : "text-ink"
            }`}
          >
            {e.allDay ? null : <span className="flex-shrink-0 text-[10px] text-ink-muted">{eventTimeLabel(e)}</span>}
            <span className="truncate">{e.title || "未命名事件"}</span>
          </button>
        ))}
      </div>

      <div className="flex-1" />
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={() => onOpenCalendar(`/calendar?date=${today}&new=1`)}
          className="flex items-center gap-0.5 text-xs text-ink-muted hover:text-primary px-1.5 py-1 rounded-btn transition-colors whitespace-nowrap"
          title="快速新增今日事件"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m-7-7h14" />
          </svg>
          <span className="hidden sm:inline">新增</span>
        </button>
        <button
          onClick={() => onOpenCalendar("/calendar")}
          className="text-xs text-primary hover:bg-primary/10 px-1.5 py-1 rounded-btn transition-colors whitespace-nowrap"
        >
          查看日历
        </button>
      </div>
    </div>
  );
}
