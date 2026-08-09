"use client";

import { useEffect } from "react";
import type { CalendarEvent } from "@/types";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";
import { todayStr, weekdayLabel } from "@/lib/calendar-date";
import { eventTimeLabel } from "./EventChip";

const MONTH_NAMES = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];

interface Props {
  /** 卡片主体点击：打开右面板嵌入日历（不跳独立页） */
  onOpen: () => void;
  /** 底部「+ 添加今日事件」：打开右面板并弹出今日新建事件弹窗 */
  onOpenNew: () => void;
  /** 选中态（右面板正在展示日历） */
  active?: boolean;
}

// 左侧「日历」分组入口卡片（仅管理员展示）：工作日历入口 + 今日预览。
// 视觉与便签卡片统一（card-surface / card-selected + rounded-card）；
// 位于 NoteList 的 px-3 滚动容器内，宽度 w-full。卡片主体点击 → onOpen，底部「+」→ onOpenNew。
export default function CalendarCard({ onOpen, onOpenNew, active }: Props) {
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
  const first2 = events.slice(0, 2);

  const rootCls = active ? "card-selected card-selected-gray" : "card-surface";

  return (
    <div className={`w-full rounded-card ${rootCls}`}>
      <button
        onClick={onOpen}
        className="block w-full text-left px-3 py-2.5 rounded-t-card"
        title="打开工作日历"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            <svg className="w-4 h-4 text-primary flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            工作日历
          </span>
          <span className="flex-shrink-0 text-xs text-ink-muted">今天</span>
        </div>

        {loading ? (
          <div className="mt-1.5 text-xs text-ink-muted">加载中...</div>
        ) : (
          <>
            <div className="mt-1 text-xs text-ink-muted">
              {dateLabel} · 今日未完成{" "}
              <span className="font-semibold text-ink">{undone.length}</span> 项
            </div>
            {first2.length === 0 ? (
              <div className="mt-1.5 text-xs text-ink-muted">今天暂无事件</div>
            ) : (
              <div className="mt-1.5 space-y-1">
                {first2.map((e: CalendarEvent) => (
                  <div
                    key={e.id}
                    className={`flex items-center gap-1.5 text-xs ${
                      e.status === "done"
                        ? "text-ink-muted/60 line-through"
                        : "text-ink-secondary"
                    }`}
                  >
                    <span className="flex-shrink-0 w-9 text-[10px] text-ink-muted">
                      {e.allDay ? "全天" : eventTimeLabel(e)}
                    </span>
                    <span className="min-w-0 truncate">{e.title || "未命名事件"}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </button>

      <button
        onClick={onOpenNew}
        className="flex items-center gap-1 w-full border-t border-border-light/60 px-3 py-1.5 text-xs text-ink-muted hover:text-primary transition-colors"
        title="添加今日事件"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m-7-7h14" />
        </svg>
        添加今日事件
      </button>
    </div>
  );
}
