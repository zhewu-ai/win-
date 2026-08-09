"use client";

import { useMemo } from "react";
import type { WorkProjectColor, WorkScheduleItem } from "@/types";
import { fromDateStr, isSameDay, monthGrid, toDateStr } from "@/lib/calendar-date";
import { wpClass } from "./color";

interface Props {
  monthDate: Date;
  /** 已按可见项目过滤。 */
  items: WorkScheduleItem[];
  today: Date;
  colorOf: (projectId: string) => WorkProjectColor;
  onItemClick: (item: WorkScheduleItem) => void;
  onSelectDay: (dateStr: string) => void;
}

interface Bar {
  item: WorkScheduleItem;
  colStart: number;
  colSpan: number;
  lane: number;
}

function dayDiff(a: string, b: string): number {
  return Math.round((fromDateStr(b).getTime() - fromDateStr(a).getTime()) / 86400000);
}

/** 每周的甘特条：连续阶段跨日期连成一条（不每天散落），同周多项目上下分轨。 */
function computeWeekBars(items: WorkScheduleItem[], weekStartStr: string, weekEndStr: string): Bar[] {
  const ranges = items
    .filter((it) => it.type === "range" && it.startDate <= weekEndStr && it.endDate >= weekStartStr)
    .map((it) => {
      const vs = it.startDate > weekStartStr ? it.startDate : weekStartStr;
      const ve = it.endDate < weekEndStr ? it.endDate : weekEndStr;
      return { item: it, colStart: dayDiff(weekStartStr, vs), colEnd: dayDiff(weekStartStr, ve) };
    })
    .sort((a, b) => (a.item.startDate < b.item.startDate ? -1 : 1));

  const lanes: number[][] = Array.from({ length: 7 }, () => []);
  const bars: Bar[] = [];
  for (const r of ranges) {
    let lane = 0;
    for (;;) {
      let blocked = false;
      for (let c = r.colStart; c <= r.colEnd; c++) {
        if (lanes[c].includes(lane)) {
          blocked = true;
          break;
        }
      }
      if (!blocked) break;
      lane++;
    }
    for (let c = r.colStart; c <= r.colEnd; c++) lanes[c].push(lane);
    bars.push({ item: r.item, colStart: r.colStart, colSpan: r.colEnd - r.colStart + 1, lane });
  }
  return bars;
}

const WEEKDAY_LABELS = ["一", "二", "三", "四", "五", "六", "日"];

export default function WorkMonthView({ monthDate, items, today, colorOf, onItemClick, onSelectDay }: Props) {
  const cells = useMemo(() => monthGrid(monthDate.getFullYear(), monthDate.getMonth()), [monthDate]);
  const rows = useMemo(() => {
    const out: typeof cells[] = [];
    for (let i = 0; i < cells.length; i += 7) out.push(cells.slice(i, i + 7));
    return out;
  }, [cells]);

  const nodesByDate = useMemo(() => {
    const m = new Map<string, WorkScheduleItem[]>();
    for (const it of items) {
      if (it.type !== "node") continue;
      const arr = m.get(it.startDate);
      if (arr) arr.push(it);
      else m.set(it.startDate, [it]);
    }
    return m;
  }, [items]);

  const hasAny = items.length > 0;

  return (
    <div className="flex flex-col">
      {/* 表头 */}
      <div className="grid grid-cols-7 border-b border-border-light">
        {WEEKDAY_LABELS.map((label, i) => (
          <div
            key={i}
            className={`px-1 py-1.5 text-center text-xs font-medium ${
              i >= 5 ? "text-accent-pink" : "text-ink-muted"
            }`}
          >
            {label}
          </div>
        ))}
      </div>

      {rows.map((row, ri) => {
        const weekStartStr = toDateStr(row[0].date);
        const weekEndStr = toDateStr(row[6].date);
        const bars = computeWeekBars(items, weekStartStr, weekEndStr);
        const laneCount = bars.length ? Math.max(...bars.map((b) => b.lane)) + 1 : 0;
        return (
          <div key={ri} className="border-b border-border-light/60">
            {/* 甘特条轨道（sm 以上显示） */}
            {laneCount > 0 && (
              <div className="relative hidden sm:block" style={{ height: laneCount * 20 + 4 }}>
                {bars.map((b) => (
                  <button
                    key={b.item.id}
                    type="button"
                    onClick={() => onItemClick(b.item)}
                    title={b.item.title}
                    className={`absolute h-[18px] overflow-hidden rounded-sm px-1.5 text-[10px] leading-[17px] text-left whitespace-nowrap ${wpClass(
                      colorOf(b.item.projectId)
                    )} wp-bar transition-colors`}
                    style={{
                      left: `${(b.colStart / 7) * 100}%`,
                      width: `${(b.colSpan / 7) * 100}%`,
                      top: `${b.lane * 20}px`,
                    }}
                  >
                    {b.item.title}
                  </button>
                ))}
              </div>
            )}

            {/* 日期行 + 节点 */}
            <div className="grid grid-cols-7">
              {row.map(({ date, inMonth }) => {
                const key = toDateStr(date);
                const dayNodes = nodesByDate.get(key) ?? [];
                const dayRanges = items.filter((it) => it.type === "range" && it.startDate <= key && it.endDate >= key);
                const cellItems = [...dayNodes, ...dayRanges];
                const isToday = isSameDay(date, today);
                const dotColors = [...new Set(cellItems.slice(0, 3).map((it) => colorOf(it.projectId)))];
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
                    className={`group flex flex-col min-h-[52px] items-stretch border-r border-border-light/60 px-1 pt-1 pb-1 text-left cursor-pointer transition-colors hover:bg-surface-hover last:border-r-0 ${
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

                    {/* 桌面：节点小卡（最多 2 条），range 由上方甘特条承载 */}
                    <div className="hidden sm:flex flex-col gap-0.5 min-h-0">
                      {dayNodes.slice(0, 2).map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            onItemClick(n);
                          }}
                          className={`text-left text-[10px] leading-tight rounded px-1 py-0.5 truncate ${wpClass(
                            colorOf(n.projectId)
                          )} wp-chip transition-colors`}
                        >
                          {n.title}
                        </button>
                      ))}
                      {dayNodes.length > 2 && <span className="px-1 text-[10px] text-ink-muted">+{dayNodes.length - 2}</span>}
                    </div>

                    {/* 窄窗口：项目色圆点 */}
                    <div className="sm:hidden flex items-center gap-0.5 mt-0.5 flex-wrap">
                      {cellItems.length > 0 &&
                        dotColors.map((c, i) => (
                          <span key={i} className={`h-1.5 w-1.5 rounded-full wp-dot ${wpClass(c)}`} />
                        ))}
                      {cellItems.length > 3 && <span className="text-[9px] text-ink-muted">+{cellItems.length - 3}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {!hasAny && (
        <div className="py-14 text-center text-sm text-ink-muted">当前筛选下没有排期。</div>
      )}
    </div>
  );
}
