"use client";

import { useCallback, useEffect, useState } from "react";
import type { WorkScheduleItem } from "@/types";
import { todayStr, weekdayLabel } from "@/lib/calendar-date";

const MONTH_NAMES = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];

function shortDate(s: string): string {
  const [, m, d] = s.split("-");
  return `${parseInt(m, 10)}/${parseInt(d, 10)}`;
}

interface Props {
  /** 卡片主体点击：打开右面板嵌入日历（不跳独立页） */
  onOpen: () => void;
  /** 底部「+ 添加排期」：打开右面板并弹出今日新建排期弹窗 */
  onOpenNew: () => void;
  /** 选中态（右面板正在展示日历）：蓝色衬底，与便签选中态一致 */
  active?: boolean;
}

// 左侧「日历」分组入口卡片（仅管理员展示）：工作日历入口 + 今日排期预览。
// 数据源 = work-schedule-items（今日范围）；视觉与便签卡片统一（card-surface / card-selected-blue）。
export default function CalendarCard({ onOpen, onOpenNew, active }: Props) {
  const [items, setItems] = useState<WorkScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchToday = useCallback(async () => {
    const s = todayStr();
    try {
      const res = await fetch(`/api/work-schedule-items?from=${s}&to=${s}`);
      const data = await res.json();
      if (res.ok && data.ok) setItems((data.items as WorkScheduleItem[]) ?? []);
    } catch {
      // 静默降级：今日预览留空
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchToday();
    const onFocus = () => void fetchToday();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchToday]);

  const now = new Date();
  const dow = now.getDay();
  const dateLabel = `${MONTH_NAMES[now.getMonth()]} 月 ${now.getDate()} 日 · 周${weekdayLabel(
    dow === 0 ? 6 : dow - 1
  )}`;
  const undone = items.filter((it) => it.status !== "done");
  const first2 = undone.slice(0, 2);

  const rootCls = active ? "card-selected card-selected-blue" : "card-surface";
  const muted = active ? "text-white/[0.78]" : "text-ink-muted";
  const titleCls = active ? "text-white" : "text-ink";
  const itemTitleCls = active ? "text-white/90" : "text-ink-secondary";

  return (
    <div className={`w-full rounded-card ${rootCls}`}>
      <button
        onClick={onOpen}
        className="block w-full text-left px-3 py-2.5 rounded-t-card"
        title="打开工作日历"
      >
        <div className="flex items-center justify-between gap-2">
          <span className={`flex items-center gap-1.5 text-sm font-semibold ${titleCls}`}>
            <svg
              className={`w-4 h-4 flex-shrink-0 ${active ? "text-white" : "text-primary"}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            工作日历
          </span>
          <span className={`flex-shrink-0 text-xs ${muted}`}>今天</span>
        </div>

        {loading ? (
          <div className={`mt-1.5 text-xs ${muted}`}>加载中...</div>
        ) : (
          <>
            <div className={`mt-1 text-xs ${muted}`}>
              {dateLabel} · 今日未完成{" "}
              <span className={`font-semibold ${active ? "text-white" : "text-ink"}`}>{undone.length}</span> 项
            </div>
            {first2.length === 0 ? (
              <div className={`mt-1.5 text-xs ${muted}`}>今天暂无排期</div>
            ) : (
              <div className="mt-1.5 space-y-1">
                {first2.map((it) => (
                  <div key={it.id} className={`flex items-center gap-1.5 text-xs ${itemTitleCls}`}>
                    <span
                      className={`flex-shrink-0 ${
                        it.type === "node" ? "w-1.5 h-1.5 rounded-full" : "w-1 h-3 rounded-sm"
                      } ${active ? "bg-white/70" : "bg-ink-muted/40"}`}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 truncate">{it.title || "未命名排期"}</span>
                    <span className={`ml-auto flex-shrink-0 text-[10px] ${active ? "text-white/60" : "text-ink-muted/70"}`}>
                      {it.type === "node"
                        ? shortDate(it.startDate)
                        : `${shortDate(it.startDate)}-${shortDate(it.endDate)}`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </button>

      <button
        onClick={onOpenNew}
        className={`flex items-center gap-1 w-full border-t px-3 py-1.5 text-xs transition-colors ${
          active
            ? "border-white/20 text-white/80 hover:text-white"
            : "border-border-light/60 text-ink-muted hover:text-primary"
        }`}
        title="添加今日排期"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m-7-7h14" />
        </svg>
        添加排期
      </button>
    </div>
  );
}
