"use client";

import { useMemo } from "react";
import type { WorkProjectColor, WorkScheduleItem } from "@/types";
import { fromDateStr, isSameDay, monthGrid, toDateStr } from "@/lib/calendar-date";
import { wpClass } from "./color";

interface Props {
  monthDate: Date;
  /** 已按可见项目过滤（含全量日期，本组件自行按本月裁剪）。 */
  items: WorkScheduleItem[];
  today: Date;
  colorOf: (projectId: string) => WorkProjectColor;
  /** 便签链接层：关闭时隐藏条目上的「关联便签」指示（条目本身保留）。 */
  showNoteLayer: boolean;
  onItemClick: (item: WorkScheduleItem) => void;
  onSelectDay: (dateStr: string) => void;
}

const ROW_H = 104;
const LANE_TOP = 28;
const LANE_H = 26;
const MAX_LANES = 3;

function dayDiff(a: string, b: string): number {
  return Math.round((fromDateStr(b).getTime() - fromDateStr(a).getTime()) / 86400000);
}

interface Seg {
  item: WorkScheduleItem;
  row: number;
  col: number;
  span: number;
  lane: number;
  isStart: boolean;
  isEnd: boolean;
}

const WEEKDAY_LABELS = ["一", "二", "三", "四", "五", "六", "日"];

export default function WorkMonthView({ monthDate, items, today, colorOf, showNoteLayer, onItemClick, onSelectDay }: Props) {
  const cells = useMemo(() => monthGrid(monthDate.getFullYear(), monthDate.getMonth()), [monthDate]);
  const gridStartStr = useMemo(() => toDateStr(cells[0].date), [cells]);

  // 甘特段：range 跨行拆段、node 单段；每行内贪心分轨（最多 3 条），超轨折叠为「+N 更多」。
  const { segs, perRowOverflow } = useMemo(() => {
    const segs: Seg[] = [];
    const rows: Seg[][] = Array.from({ length: 6 }, () => []);

    for (const it of items) {
      const s = Math.max(0, dayDiff(gridStartStr, it.startDate));
      const e = Math.min(41, dayDiff(gridStartStr, it.endDate));
      if (e < 0 || s > 41 || s > e) continue;

      if (it.type === "node") {
        const seg: Seg = { item: it, row: Math.floor(s / 7), col: s % 7, span: 1, lane: 0, isStart: true, isEnd: true };
        segs.push(seg);
        rows[seg.row].push(seg);
        continue;
      }

      let cur = s;
      while (cur <= e) {
        const row = Math.floor(cur / 7);
        const rowEnd = Math.min(e, row * 7 + 6);
        const seg: Seg = {
          item: it,
          row,
          col: cur % 7,
          span: rowEnd - cur + 1,
          lane: 0,
          isStart: cur === s,
          isEnd: rowEnd === e,
        };
        segs.push(seg);
        rows[row].push(seg);
        cur = rowEnd + 1;
      }
    }

    const perRowOverflow = Array.from({ length: 6 }, () => 0);
    for (let r = 0; r < 6; r++) {
      const rowSegs = rows[r].sort((a, b) => a.col - b.col || a.span - b.span);
      const occupied: number[][] = Array.from({ length: 7 }, () => []);
      for (const sg of rowSegs) {
        let lane = -1;
        for (let L = 0; L < MAX_LANES; L++) {
          let blocked = false;
          for (let c = sg.col; c < sg.col + sg.span; c++) {
            if (occupied[c].includes(L)) {
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
          sg.lane = lane;
          for (let c = sg.col; c < sg.col + sg.span; c++) occupied[c].push(lane);
        } else {
          perRowOverflow[r]++;
        }
      }
    }

    return { segs, perRowOverflow };
  }, [items, gridStartStr]);

  const hasAny = items.length > 0;

  return (
    <div>
      {/* 表头 */}
      <div className="grid grid-cols-7 border-b border-border-light">
        {WEEKDAY_LABELS.map((label, i) => (
          <div key={i} className={`px-1 py-1.5 text-center text-xs font-semibold ${i >= 5 ? "text-accent-pink" : "text-ink-muted"}`}>
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
            const colors = useMemo(() => {
              const set = new Set<string>();
              for (const it of items) {
                if (it.startDate <= key && it.endDate >= key) set.add(colorOf(it.projectId));
              }
              return [...set];
            }, [items, key]);
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
                className={`relative h-[104px] cursor-pointer border-r border-b border-border-light/60 px-1 pt-1 transition-colors hover:bg-surface-hover [&:nth-child(7n)]:border-r-0 ${
                  inMonth ? "" : "bg-page-bg/40"
                }`}
              >
                <span
                  className={`flex h-5 min-w-5 items-center justify-center self-start rounded-full px-1 text-xs font-semibold ${
                    isToday ? "bg-primary text-white" : inMonth ? "text-ink" : "text-ink-muted/50"
                  }`}
                >
                  {date.getDate()}
                </span>
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

        {/* 甘特层：覆盖整月网格，条/节点按行+轨道绝对定位（桌面） */}
        <div className="pointer-events-none absolute inset-0 z-[5] hidden sm:block">
          {segs.map((sg) => {
            const it = sg.item;
            const isNode = it.type === "node";
            return (
              <button
                key={`${it.id}-${sg.row}-${sg.col}`}
                type="button"
                onClick={(ev) => {
                  ev.stopPropagation();
                  onItemClick(it);
                }}
                title={it.title}
                className={`wc-bar ${wpClass(colorOf(it.projectId))} ${isNode ? "wc-node" : ""} ${
                  sg.isStart ? "wc-start" : ""
                } ${sg.isEnd ? "wc-end" : ""}`}
                style={{
                  left: `calc(${sg.col} * 100% / 7 + 5px)`,
                  width: `calc(${sg.span} * 100% / 7 - 10px)`,
                  top: `${sg.row * ROW_H + LANE_TOP + sg.lane * LANE_H}px`,
                }}
              >
                <span className="truncate">{it.title}</span>
                {it.noteId && showNoteLayer && (
                  <svg className="wc-note-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                )}
              </button>
            );
          })}
          {perRowOverflow.map((n, r) =>
            n > 0 ? (
              <div key={r} className="absolute text-[10px] text-ink-muted" style={{ top: `${r * ROW_H + 88}px`, left: "8px" }}>
                +{n} 更多
              </div>
            ) : null
          )}
        </div>
      </div>

      {!hasAny && <div className="py-14 text-center text-sm text-ink-muted">当前筛选下没有排期。</div>}
    </div>
  );
}
