"use client";

import { useMemo } from "react";
import type { Note, WorkProjectColor, WorkScheduleItem } from "@/types";
import { toDateStr, weekdayLabel } from "@/lib/calendar-date";
import { wpClass } from "./color";

interface Props {
  date: Date;
  /** 已按可见项目过滤；本视图内再按今天拆分。 */
  items: WorkScheduleItem[];
  /** 便签链接层数据源：今天创建/更新的便签。 */
  notes: Note[];
  today: Date;
  colorOf: (projectId: string) => WorkProjectColor;
  onItemClick: (item: WorkScheduleItem) => void;
  onToggleDone: (item: WorkScheduleItem) => void;
  onNewItem: (dateStr: string) => void;
  onOpenNote: (noteId: string) => void;
}

const MONTH_NAMES = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];

function shortDate(s: string): string {
  const [, m, d] = s.split("-");
  return `${parseInt(m, 10)}/${parseInt(d, 10)}`;
}

function SectionTitle({ label }: { label: string }) {
  return (
    <h3 className="px-1 pt-4 pb-1.5 text-[13px] font-bold text-ink-muted flex items-center gap-1.5">
      <span className="w-1 h-3.5 rounded-sm bg-primary/60" />
      {label}
    </h3>
  );
}

export default function WorkTodayView({
  date,
  items,
  notes,
  today,
  colorOf,
  onItemClick,
  onToggleDone,
  onNewItem,
  onOpenNote,
}: Props) {
  const dateStr = toDateStr(date);
  const dow = date.getDay();
  const weekday = `周${weekdayLabel(dow === 0 ? 6 : dow - 1)}`;
  const weekend = dow === 0 || dow === 6;
  const isToday = dateStr === toDateStr(today);

  const todayRanges = useMemo(
    () =>
      items
        .filter((it) => it.type === "range" && it.startDate <= dateStr && it.endDate >= dateStr && it.status !== "done")
        .sort((a, b) => (a.startDate < b.startDate ? -1 : 1)),
    [items, dateStr]
  );
  const todayNodes = useMemo(
    () =>
      items
        .filter((it) => it.type === "node" && it.startDate === dateStr)
        .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)),
    [items, dateStr]
  );
  const todayNotes = useMemo(() => {
    return notes.filter((n) => {
      if (!n.createdAt && !n.updatedAt) return false;
      const c = n.createdAt ? toDateStr(new Date(n.createdAt)) : "";
      const u = n.updatedAt ? toDateStr(new Date(n.updatedAt)) : "";
      return c === dateStr || u === dateStr;
    });
  }, [notes, dateStr]);

  const emptyAll = todayRanges.length === 0 && todayNodes.length === 0;

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 px-1 py-2">
        <h2 className="text-base font-bold text-ink">
          {MONTH_NAMES[date.getMonth()]} 月 {date.getDate()} 日
        </h2>
        <span className={`text-xs ${weekend ? "text-accent-pink" : "text-ink-muted"}`}>{weekday}</span>
        {isToday && <span className="px-1.5 py-0.5 rounded-full bg-primary text-white text-[10px] font-bold">今天</span>}
        <div className="flex-1" />
        <button
          onClick={() => onNewItem(dateStr)}
          className="flex items-center gap-1 px-2.5 py-1 text-sm font-medium text-primary hover:bg-primary/10 rounded-btn transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m-7-7h14" />
          </svg>
          新建排期
        </button>
      </div>

      {emptyAll && todayNotes.length === 0 ? (
        <div className="px-3 py-10 text-center text-sm text-ink-muted">今天没有进行中的排期。</div>
      ) : (
        <div className="flex flex-col">
          {/* 今天要做：进行中的连续阶段 */}
          <SectionTitle label="今天要做" />
          {todayRanges.length === 0 && <div className="px-3 py-2 text-sm text-ink-muted/70">今天没有进行中的阶段</div>}
          {todayRanges.map((it) => (
            <div key={it.id} className="flex items-start gap-2 px-2 py-1.5 rounded-btn hover:bg-surface-hover transition-colors group">
              <button
                type="button"
                onClick={() => onToggleDone(it)}
                aria-label="标记完成"
                className={`mt-0.5 flex-shrink-0 h-4 w-4 flex items-center justify-center rounded border transition-colors ${
                  it.status === "done"
                    ? "bg-primary border-primary text-white"
                    : "border-border-strong bg-panel-bg hover:border-primary/50"
                }`}
              >
                {it.status === "done" && (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
              <button type="button" onClick={() => onItemClick(it)} className="flex-1 min-w-0 text-left">
                <span className={`flex items-center gap-1.5 text-sm text-ink truncate`}>
                  <span className={`w-1.5 h-1.5 rounded-full wp-dot ${wpClass(colorOf(it.projectId))}`} aria-hidden="true" />
                  {it.title || "未命名阶段"}
                </span>
                <span className="block text-xs text-ink-muted">
                  {shortDate(it.startDate)} - {shortDate(it.endDate)} 阶段
                  {it.note ? " · 已关联便签" : ""}
                </span>
              </button>
            </div>
          ))}

          {/* 今天节点 */}
          <SectionTitle label="今天节点" />
          {todayNodes.length === 0 && <div className="px-3 py-2 text-sm text-ink-muted/70">今天没有节点</div>}
          {todayNodes.map((it) => {
            const done = it.status === "done";
            return (
              <div key={it.id} className="flex items-start gap-2 px-2 py-1.5 rounded-btn hover:bg-surface-hover transition-colors group">
                <button
                  type="button"
                  onClick={() => onToggleDone(it)}
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
                <button type="button" onClick={() => onItemClick(it)} className="flex-1 min-w-0 text-left">
                  <span className={`block text-sm truncate ${done ? "line-through opacity-50" : "text-ink"}`}>
                    {it.title || "未命名节点"}
                  </span>
                  <span className="block text-xs text-ink-muted">
                    节点
                    {it.note ? " · 已关联便签" : ""}
                  </span>
                </button>
              </div>
            );
          })}

          {/* 今天编辑的便签（便签链接层，可开关） */}
          <SectionTitle label="今天编辑的便签" />
          {todayNotes.length === 0 && <div className="px-3 py-2 text-sm text-ink-muted/70">今天没有编辑的便签</div>}
          {todayNotes.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => onOpenNote(n.id)}
              className="flex items-center gap-2 px-2 py-1.5 rounded-btn hover:bg-surface-hover transition-colors w-full text-left"
            >
              <svg className="w-3.5 h-3.5 flex-shrink-0 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="flex-1 min-w-0 text-sm text-ink truncate">{n.title || "未命名便签"}</span>
              <span className="text-xs text-ink-muted flex-shrink-0">
                {n.createdAt && toDateStr(new Date(n.createdAt)) === dateStr ? "今天创建" : "今天更新"}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
