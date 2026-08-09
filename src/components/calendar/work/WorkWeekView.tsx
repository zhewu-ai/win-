"use client";

import { useMemo } from "react";
import type { WorkProjectColor, WorkScheduleItem } from "@/types";
import { addDays, isSameDay, toDateStr } from "@/lib/calendar-date";
import { wpClass } from "./color";

interface Props {
  weekStart: Date;
  /** 已按可见项目过滤。 */
  items: WorkScheduleItem[];
  today: Date;
  colorOf: (projectId: string) => WorkProjectColor;
  /** 便签链接层：关闭时隐藏条目上的「关联便签」指示。 */
  showNoteLayer: boolean;
  onItemClick: (item: WorkScheduleItem) => void;
  onSelectDay: (dateStr: string) => void;
}

const WEEK_LABELS = ["一", "二", "三", "四", "五", "六", "日"];

function shortDate(s: string): string {
  const [, m, d] = s.split("-");
  return `${parseInt(m, 10)}/${parseInt(d, 10)}`;
}

function itemsOnDay(items: WorkScheduleItem[], dayStr: string): WorkScheduleItem[] {
  return items
    .filter((it) => it.startDate <= dayStr && it.endDate >= dayStr)
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === "node" ? -1 : 1;
      return a.createdAt < b.createdAt ? -1 : 1;
    });
}

// 任务卡（原型 task-card）：浅底 + 1px 边框 + 4px 项目色左边条 + 标题 + 日期说明。
function TaskCard({ item, colorOf, showNoteLayer, onClick }: {
  item: WorkScheduleItem;
  colorOf: (projectId: string) => WorkProjectColor;
  showNoteLayer: boolean;
  onClick: () => void;
}) {
  const rangeText = item.type === "range" ? `${shortDate(item.startDate)} - ${shortDate(item.endDate)}` : shortDate(item.startDate);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group rounded-btn border border-border-light bg-surface-strong/60 px-2 py-1.5 text-left transition-colors hover:bg-surface-hover ${wpClass(colorOf(item.projectId))}`}
      style={{ borderLeftWidth: 4, borderLeftColor: "var(--wp-base)" }}
    >
      <span className="flex items-center gap-1 min-w-0">
        <span className="truncate text-xs font-semibold leading-[1.35] text-ink">{item.title || "未命名"}</span>
        {item.noteId && showNoteLayer && (
          <svg className="w-3 h-3 flex-shrink-0 text-ink-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        )}
      </span>
      <span className="mt-0.5 block text-[11px] leading-[1.35] text-ink-muted">{rangeText}</span>
    </button>
  );
}

function WeekdayHead({ date, today, onSelectDay }: { date: Date; today: Date; onSelectDay: (s: string) => void }) {
  const isToday = isSameDay(date, today);
  const label = `周${WEEK_LABELS[date.getDay() === 0 ? 6 : date.getDay() - 1]}`;
  return (
    <button
      type="button"
      onClick={() => onSelectDay(toDateStr(date))}
      className="flex flex-col items-center gap-0.5 px-1 py-2 transition-colors hover:bg-surface-hover"
    >
      <span className={`text-xs font-semibold ${isToday ? "text-primary" : "text-ink-muted"}`}>{label}</span>
      <span
        className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${
          isToday ? "bg-primary text-white font-bold" : "text-ink"
        }`}
      >
        {date.getDate()}
      </span>
    </button>
  );
}

// 周视图：周一到周日七列，命中的排期显示为 task-card（浅底 + 4px 项目色左条），今天列高亮，空列「无排期」。
export default function WorkWeekView({ weekStart, items, today, colorOf, showNoteLayer, onItemClick, onSelectDay }: Props) {
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const dayStrMap = useMemo(() => {
    const m = new Map<string, WorkScheduleItem[]>();
    for (const d of days) {
      const key = toDateStr(d);
      const arr = itemsOnDay(items, key);
      if (arr.length) m.set(key, arr);
    }
    return m;
  }, [items, days]);

  // 桌面：week-head + week-grid 七列（始终渲染，空列显示「无排期」）
  const desktop = (
    <div className="hidden sm:block">
      <div className="grid grid-cols-7 border-b border-border-light bg-surface-strong/40">
        {days.map((d) => (
          <WeekdayHead key={toDateStr(d)} date={d} today={today} onSelectDay={onSelectDay} />
        ))}
      </div>
      <div className="grid min-h-[480px] grid-cols-7">
        {days.map((d) => {
          const key = toDateStr(d);
          const dayItems = dayStrMap.get(key) ?? [];
          const isToday = isSameDay(d, today);
          return (
            <div
              key={key}
              className={`flex flex-col items-stretch gap-1.5 border-r border-border-light/60 px-1.5 py-2 last:border-r-0 ${
                isToday ? "bg-primary/5" : ""
              }`}
            >
              {dayItems.length === 0 ? (
                <span className="px-1 py-2 text-[11px] text-ink-muted/60">无排期</span>
              ) : (
                dayItems.map((it) => (
                  <TaskCard key={it.id} item={it} colorOf={colorOf} showNoteLayer={showNoteLayer} onClick={() => onItemClick(it)} />
                ))
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  // 窄窗口：纵向 7 天列表
  const narrow = (
    <div className="flex flex-col divide-y divide-border-light/60 sm:hidden">
      {days.map((d) => {
        const key = toDateStr(d);
        const dayItems = dayStrMap.get(key) ?? [];
        const isToday = isSameDay(d, today);
        return (
          <div key={key}>
            <button
              type="button"
              onClick={() => onSelectDay(key)}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-surface-hover ${
                isToday ? "bg-primary/5" : ""
              }`}
            >
              <span className="text-sm font-medium text-ink">周{WEEK_LABELS[d.getDay() === 0 ? 6 : d.getDay() - 1]}</span>
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-sm ${
                  isToday ? "bg-primary text-white font-bold" : "text-ink"
                }`}
              >
                {d.getDate()}
              </span>
              <span className="ml-auto text-xs text-ink-muted">{dayItems.length} 项</span>
            </button>
            <div className="flex flex-col gap-1.5 px-3 pb-2">
              {dayItems.length === 0 && <span className="px-1 py-1 text-xs text-ink-muted/60">无排期</span>}
              {dayItems.map((it) => (
                <TaskCard key={it.id} item={it} colorOf={colorOf} showNoteLayer={showNoteLayer} onClick={() => onItemClick(it)} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div>
      {desktop}
      {narrow}
    </div>
  );
}
