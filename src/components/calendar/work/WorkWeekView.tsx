"use client";

import { useMemo } from "react";
import type { WorkProjectColor, WorkScheduleItem } from "@/types";
import { addDays, isSameDay, toDateStr } from "@/lib/calendar-date";
import WorkScheduleChip from "./WorkScheduleChip";

interface Props {
  weekStart: Date;
  /** 已按可见项目过滤。 */
  items: WorkScheduleItem[];
  today: Date;
  colorOf: (projectId: string) => WorkProjectColor;
  onItemClick: (item: WorkScheduleItem) => void;
  onSelectDay: (dateStr: string) => void;
}

const WEEK_LABELS = ["一", "二", "三", "四", "五", "六", "日"];

function itemsOnDay(items: WorkScheduleItem[], dayStr: string): WorkScheduleItem[] {
  return items
    .filter((it) => it.startDate <= dayStr && it.endDate >= dayStr)
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === "node" ? -1 : 1;
      return a.createdAt < b.createdAt ? -1 : 1;
    });
}

function DayHeader({ date, today, onSelectDay }: { date: Date; today: Date; onSelectDay: (s: string) => void }) {
  const isToday = isSameDay(date, today);
  const label = `周${WEEK_LABELS[date.getDay() === 0 ? 6 : date.getDay() - 1]}`;
  return (
    <button
      type="button"
      onClick={() => onSelectDay(toDateStr(date))}
      className={`flex flex-col items-center py-1.5 border-b border-border-light/60 transition-colors hover:bg-surface-hover ${
        isToday ? "bg-primary/5" : ""
      }`}
    >
      <span className={`text-xs ${isToday ? "text-primary font-bold" : "text-ink-muted"}`}>{label}</span>
      <span
        className={`mt-0.5 h-6 w-6 flex items-center justify-center rounded-full text-sm ${
          isToday ? "bg-primary text-white font-bold" : "text-ink"
        }`}
      >
        {date.getDate()}
      </span>
    </button>
  );
}

// 周视图（默认视图）：周一到周日七列，命中当天的 range 显示为紧凑小卡、node 只出现在对应日期。
export default function WorkWeekView({ weekStart, items, today, colorOf, onItemClick, onSelectDay }: Props) {
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

  const hasAny = days.some((d) => (dayStrMap.get(toDateStr(d))?.length ?? 0) > 0);

  if (!hasAny) {
    return (
      <div className="py-14 text-center text-sm text-ink-muted">本周没有排期，点击右上角「新增排期」或「快速录入一周」开始。</div>
    );
  }

  // 桌面：7 列
  const desktop = (
    <div className="hidden sm:grid sm:grid-cols-7 sm:border-b sm:border-border-light">
      {days.map((d) => {
        const key = toDateStr(d);
        const dayItems = dayStrMap.get(key) ?? [];
        return (
          <div key={key} className="flex flex-col min-h-[120px] border-r border-border-light/60 last:border-r-0">
            <DayHeader date={d} today={today} onSelectDay={onSelectDay} />
            <div className="flex-1 flex flex-col gap-0.5 p-1">
              {dayItems.length === 0 && <span className="text-[10px] text-ink-muted/50">无</span>}
              {dayItems.map((it) => (
                <WorkScheduleChip key={it.id} item={it} colorKey={colorOf(it.projectId)} onClick={() => onItemClick(it)} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );

  // 窄窗口：纵向 7 天列表
  const narrow = (
    <div className="sm:hidden flex flex-col divide-y divide-border-light/60">
      {days.map((d) => {
        const key = toDateStr(d);
        const dayItems = dayStrMap.get(key) ?? [];
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
              <span className="text-sm font-medium text-ink">周{WEEK_LABELS[d.getDay() === 0 ? 6 : d.getDay() - 1]}</span>
              <span
                className={`h-6 w-6 flex items-center justify-center rounded-full text-sm ${
                  isToday ? "bg-primary text-white font-bold" : "text-ink"
                }`}
              >
                {d.getDate()}
              </span>
              <span className="ml-auto text-xs text-ink-muted">{dayItems.length} 项</span>
            </button>
            <div className="px-3 pb-2 flex flex-col gap-0.5">
              {dayItems.length === 0 && <span className="text-xs text-ink-muted/50">无排期</span>}
              {dayItems.map((it) => (
                <WorkScheduleChip key={it.id} item={it} colorKey={colorOf(it.projectId)} onClick={() => onItemClick(it)} />
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
