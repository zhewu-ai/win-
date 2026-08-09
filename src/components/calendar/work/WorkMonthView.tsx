"use client";

import { useMemo } from "react";
import type { Note, WorkProjectColor, WorkScheduleItem } from "@/types";
import { fromDateStr, isSameDay, monthGrid, toDateStr } from "@/lib/calendar-date";
import { wpClass } from "./color";

interface Props {
  monthDate: Date;
  /** 已按可见项目过滤（含全量日期，本组件自行按本月裁剪）。 */
  items: WorkScheduleItem[];
  /** 2.6 便签链接层：当天创建/更新的便签（外部已按 showNoteLayer 过滤）。 */
  notes: Note[];
  today: Date;
  colorOf: (projectId: string) => WorkProjectColor;
  /** 便签链接层：关闭时隐藏条目上的「关联便签」药丸与日期格便签指示。 */
  showNoteLayer: boolean;
  onItemClick: (item: WorkScheduleItem) => void;
  onSelectDay: (dateStr: string) => void;
  /** 2.6 便签链接层点击：单条便签直接打开；多条进入当天日视图。 */
  onOpenNote: (noteId: string) => void;
}

const ROW_H = 106;
const LANE_TOPS = [34, 56, 78];
const NOTE_TOP = 84;
const MAX_LANES = 3;

const WEEKDAY_LABELS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

function dayDiff(a: string, b: string): number {
  return Math.round((fromDateStr(b).getTime() - fromDateStr(a).getTime()) / 86400000);
}

interface Bar {
  item: WorkScheduleItem;
  row: number;
  col: number;
  span: number;
  lane: number;
}
interface Pill {
  item: WorkScheduleItem;
  row: number;
  col: number;
  span: number;
}

export default function WorkMonthView({ monthDate, items, notes, today, colorOf, showNoteLayer, onItemClick, onSelectDay, onOpenNote }: Props) {
  const cells = useMemo(() => monthGrid(monthDate.getFullYear(), monthDate.getMonth()), [monthDate]);
  const gridStartStr = useMemo(() => toDateStr(cells[0].date), [cells]);

  // 2.6 便签链接层：按天归集当天创建/更新的便签
  const notesByDay = useMemo(() => {
    const m = new Map<string, Note[]>();
    for (const n of notes) {
      const days = new Set<string>();
      if (n.createdAt) days.add(toDateStr(new Date(n.createdAt)));
      if (n.updatedAt) days.add(toDateStr(new Date(n.updatedAt)));
      for (const d of days) {
        const arr = m.get(d) ?? [];
        arr.push(n);
        m.set(d, arr);
      }
    }
    return m;
  }, [notes]);

  // 月历覆盖层：连续阶段/单日节点拆段入轨，便签药丸独立于排期条；每格项目色点供窄屏降级。
  const { bars, pills, dayColors } = useMemo(() => {
    const bars: Bar[] = [];
    const dayColors = new Map<string, Set<string>>();
    const cellKeys = cells.map((c) => toDateStr(c.date));
    const rowLanes: number[][][] = Array.from({ length: 6 }, () => Array.from({ length: 7 }, () => [] as number[]));
    const rowHasLane2 = Array(6).fill(false);

    const segOf = (it: WorkScheduleItem): { s: number; e: number } | null => {
      const s = Math.max(0, dayDiff(gridStartStr, it.startDate));
      const e = Math.min(41, dayDiff(gridStartStr, it.endDate));
      if (e < 0 || s > 41 || s > e) return null;
      return { s, e };
    };

    // 连续阶段优先占轨，单日节点随后。
    for (const it of [...items.filter((i) => i.type === "range"), ...items.filter((i) => i.type === "node")]) {
      const r = segOf(it);
      if (!r) continue;

      for (let d = r.s; d <= r.e; d++) {
        const key = cellKeys[d];
        if (!dayColors.has(key)) dayColors.set(key, new Set());
        dayColors.get(key)!.add(colorOf(it.projectId));
      }

      let cur = r.s;
      while (cur <= r.e) {
        const row = Math.floor(cur / 7);
        const rowEnd = Math.min(r.e, row * 7 + 6);
        const col = cur % 7;
        const span = rowEnd - cur + 1;

        let lane = -1;
        for (let L = 0; L < MAX_LANES; L++) {
          let blocked = false;
          for (let c = col; c < col + span; c++) {
            if (rowLanes[row][c].includes(L)) {
              blocked = true;
              break;
            }
          }
          if (!blocked) {
            lane = L;
            break;
          }
        }
        if (lane >= 0) {
          for (let c = col; c < col + span; c++) rowLanes[row][c].push(lane);
          bars.push({ item: it, row, col, span, lane });
          if (lane === 2) rowHasLane2[row] = true;
        }
        cur = rowEnd + 1;
      }
    }

    // 便签药丸由排期条派生：只给 lane<2 且所在行未占满 3 轨的段，避免与 lane-2 条叠压。
    const pills: Pill[] = [];
    for (const b of bars) {
      if (b.lane > 1 || rowHasLane2[b.row]) continue;
      if (showNoteLayer && b.item.noteId && b.item.note?.title) {
        pills.push({ item: b.item, row: b.row, col: b.col, span: b.span });
      }
    }

    return {
      bars,
      pills,
      dayColors: new Map([...dayColors].map(([k, v]) => [k, [...v]])),
    };
  }, [items, gridStartStr, cells, showNoteLayer, colorOf]);

  return (
    <div>
      {/* 表头：周一~周日 */}
      <div className="grid grid-cols-7 border-b border-border-light bg-panel-bg">
        {WEEKDAY_LABELS.map((label, i) => (
          <div key={i} className={`px-1 py-2 text-center text-xs font-semibold ${i >= 5 ? "text-accent-pink" : "text-ink-muted"}`}>
            {label}
          </div>
        ))}
      </div>

      <div className="relative">
        {/* 42 格日历：行高固定，日期号左上，窄屏显示项目色点 */}
        <div className="grid grid-cols-7">
          {cells.map(({ date, inMonth }) => {
            const key = toDateStr(date);
            const isToday = isSameDay(date, today);
            const colors = dayColors.get(key) ?? [];
            const dayNotes = notesByDay.get(key) ?? [];
            return (
              <div
                key={key}
                role="button"
                tabIndex={0}
                onClick={() => onSelectDay(key)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectDay(key);
                  }
                }}
                style={isToday ? { boxShadow: "inset 0 0 0 2px var(--primary)" } : undefined}
                className={`relative h-[106px] cursor-pointer border-r border-b border-border-light/60 px-1 pt-1 transition-colors hover:bg-surface-hover [&:nth-child(7n)]:border-r-0 ${
                  inMonth ? "" : "bg-page-bg/40"
                }`}
              >
                <div className="flex items-start justify-between gap-1">
                  <span
                    className={`flex h-5 min-w-5 items-center justify-center self-start rounded-full px-1 text-xs font-semibold ${
                      isToday ? "text-primary" : inMonth ? "text-ink" : "text-ink-muted/50"
                    }`}
                  >
                    {date.getDate()}
                  </span>
                  {/* 2.6 便签链接层：右上角便签指示；1 条直接打开，多条进入当天日视图 */}
                  {dayNotes.length > 0 && (
                    <button
                      type="button"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        if (dayNotes.length === 1) onOpenNote(dayNotes[0].id);
                        else onSelectDay(key);
                      }}
                      title={
                        dayNotes.length === 1
                          ? dayNotes[0].title || "未命名便签"
                          : `${dayNotes.length} 条便签，点击查看当天`
                      }
                      className="flex flex-shrink-0 items-center gap-0.5 rounded-full px-1 py-0.5 text-[var(--note)] transition-colors hover:bg-[var(--note)]/10"
                    >
                      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="text-[10px] font-semibold leading-none">{dayNotes.length}</span>
                    </button>
                  )}
                </div>
                {/* 窄屏：项目色点（不溢出、信息层级保留） */}
                <div className="mt-1 flex flex-wrap items-center gap-0.5 sm:hidden">
                  {colors.slice(0, 3).map((c, i) => (
                    <span key={i} className={`h-1.5 w-1.5 rounded-full wp-dot ${wpClass(c)}`} />
                  ))}
                  {colors.length > 3 && <span className="text-[9px] text-ink-muted">+{colors.length - 3}</span>}
                </div>
              </div>
            );
          })}
        </div>

        {/* 覆盖层：色条（连续阶段）+ 虚线节点（单日）+ 便签药丸（关联链接层） */}
        <div className="pointer-events-none absolute inset-0 z-[5] hidden sm:block">
          {bars.map((b, i) => (
            <button
              key={`${b.item.id}-${i}`}
              type="button"
              onClick={(ev) => {
                ev.stopPropagation();
                onItemClick(b.item);
              }}
              title={b.item.title}
              className={`wc-bar ${wpClass(colorOf(b.item.projectId))} ${b.item.type === "node" ? "wc-node" : ""}`}
              style={{
                left: `calc(${b.col} * 100% / 7 + 7px)`,
                width: `calc(${b.span} * 100% / 7 - 14px)`,
                top: `${b.row * ROW_H + LANE_TOPS[b.lane]}px`,
              }}
            >
              <span className="truncate">{b.item.title}</span>
            </button>
          ))}
          {pills.map((p, i) => (
            <button
              key={`pill-${p.item.id}-${i}`}
              type="button"
              onClick={(ev) => {
                ev.stopPropagation();
                onItemClick(p.item);
              }}
              title={p.item.note?.title}
              className="wc-note-pill"
              style={{
                left: `calc(${p.col} * 100% / 7 + 7px)`,
                width: `calc(${p.span} * 100% / 7 - 14px)`,
                top: `${p.row * ROW_H + NOTE_TOP}px`,
              }}
            >
              <svg className="wc-note-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="truncate">{p.item.note?.title}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
