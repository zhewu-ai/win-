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
  projectNameOf: (projectId: string) => string;
  /** 便签链接层：关闭时隐藏便签链接条目与指示。 */
  showNoteLayer: boolean;
  onItemClick: (item: WorkScheduleItem) => void;
  onToggleDone: (item: WorkScheduleItem) => void;
  onOpenNote: (noteId: string) => void;
}

const MONTH_NAMES = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];

function shortDate(s: string): string {
  const [, m, d] = s.split("-");
  return `${parseInt(m, 10)}/${parseInt(d, 10)}`;
}

function SectionTitle({ label }: { label: string }) {
  return <h3 className="px-0.5 pb-1 text-xs font-bold text-ink-muted">{label}</h3>;
}

function Empty({ text }: { text: string }) {
  return <div className="px-0.5 py-1 text-[11px] text-ink-muted/70">{text}</div>;
}

// 今天条目卡：项目色点 + 项目名 + 标题 + 说明文案（原型 today-item）。
function TodayItemCard({
  item,
  colorOf,
  projectNameOf,
  showNoteLayer,
  sub,
  onClick,
}: {
  item: WorkScheduleItem;
  colorOf: (projectId: string) => WorkProjectColor;
  projectNameOf: (projectId: string) => string;
  showNoteLayer: boolean;
  sub: string;
  onClick: () => void;
}) {
  const done = item.status === "done";
  return (
    <button
      type="button"
      onClick={onClick}
      className="group rounded-btn border border-border-light bg-panel-bg px-2 py-1.5 text-left transition-colors hover:bg-surface-hover"
    >
      <span className="flex items-center gap-1.5 min-w-0">
        <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full wp-dot ${wpClass(colorOf(item.projectId))}`} />
        <span className={`min-w-0 truncate text-xs font-semibold leading-[1.35] ${done ? "text-ink-muted line-through" : "text-ink"}`}>
          {item.title || "未命名"}
        </span>
        <span className={`ml-auto flex-shrink-0 text-[10px] ${wpClass(colorOf(item.projectId))} wp-text`}>
          {projectNameOf(item.projectId)}
        </span>
        {item.noteId && showNoteLayer && (
          <svg className="h-3 w-3 flex-shrink-0 text-ink-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        )}
      </span>
      <span className="mt-0.5 block text-[11px] leading-[1.35] text-ink-muted">{sub}</span>
    </button>
  );
}

export default function WorkTodayView({
  date,
  items,
  notes,
  today,
  colorOf,
  projectNameOf,
  showNoteLayer,
  onItemClick,
  onToggleDone,
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
    if (!showNoteLayer) return [];
    return notes.filter((n) => {
      if (!n.createdAt && !n.updatedAt) return false;
      const c = n.createdAt ? toDateStr(new Date(n.createdAt)) : "";
      const u = n.updatedAt ? toDateStr(new Date(n.updatedAt)) : "";
      return c === dateStr || u === dateStr;
    });
  }, [notes, dateStr, showNoteLayer]);

  const emptyAll = todayRanges.length === 0 && todayNodes.length === 0 && todayNotes.length === 0;

  return (
    <div className="flex flex-col gap-3 max-w-[680px]">
      <div className="flex items-baseline gap-2 px-0.5">
        <h2 className="text-base font-bold text-ink">
          {MONTH_NAMES[date.getMonth()]} 月 {date.getDate()} 日
        </h2>
        <span className={`text-xs ${weekend ? "text-accent-pink" : "text-ink-muted"}`}>{weekday}</span>
        {isToday && <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-white">今天</span>}
      </div>

      {emptyAll ? (
        <div className="px-3 py-10 text-center text-sm text-ink-muted">今天没有进行中的排期。</div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* 今天要做：进行中的连续阶段 */}
          <div className="flex flex-col gap-1.5">
            <SectionTitle label="今天要做" />
            {todayRanges.length === 0 ? (
              <Empty text="今天没有进行中的连续阶段。" />
            ) : (
              todayRanges.map((it) => (
                <div key={it.id} className="flex items-start gap-2">
                  <button
                    type="button"
                    onClick={() => onToggleDone(it)}
                    aria-label="标记完成"
                    className={`mt-1 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition-colors ${
                      it.status === "done"
                        ? "border-primary bg-primary text-white"
                        : "border-border-strong bg-panel-bg hover:border-primary/50"
                    }`}
                  >
                    {it.status === "done" && (
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <TodayItemCard
                      item={it}
                      colorOf={colorOf}
                      projectNameOf={projectNameOf}
                      showNoteLayer={showNoteLayer}
                      sub={`处于 ${shortDate(it.startDate)} - ${shortDate(it.endDate)} 阶段内，今天继续推进。`}
                      onClick={() => onItemClick(it)}
                    />
                  </div>
                </div>
              ))
            )}
          </div>

          {/* 今天节点 */}
          <div className="flex flex-col gap-1.5">
            <SectionTitle label="今天节点" />
            {todayNodes.length === 0 ? (
              <Empty text="今天没有提交、会议或反馈节点。" />
            ) : (
              todayNodes.map((it) => (
                <div key={it.id} className="flex items-start gap-2">
                  <button
                    type="button"
                    onClick={() => onToggleDone(it)}
                    aria-label={it.status === "done" ? "标记为未完成" : "标记为完成"}
                    className={`mt-1 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition-colors ${
                      it.status === "done"
                        ? "border-primary bg-primary text-white"
                        : "border-border-strong bg-panel-bg hover:border-primary/50"
                    }`}
                  >
                    {it.status === "done" && (
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <TodayItemCard
                      item={it}
                      colorOf={colorOf}
                      projectNameOf={projectNameOf}
                      showNoteLayer={showNoteLayer}
                      sub={`单日节点 · ${shortDate(it.startDate)}`}
                      onClick={() => onItemClick(it)}
                    />
                  </div>
                </div>
              ))
            )}
          </div>

          {/* 今天编辑的便签（便签链接层，受开关控制） */}
          <div className="flex flex-col gap-1.5">
            <SectionTitle label="今天编辑的便签" />
            {todayNotes.length === 0 ? (
              <Empty text="今天没有符合筛选条件的便签链接。" />
            ) : (
              <div className="flex flex-col gap-1.5">
                {todayNotes.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => onOpenNote(n.id)}
                    className="flex items-center gap-2 rounded-btn border border-border-light bg-panel-bg px-2 py-1.5 text-left transition-colors hover:bg-surface-hover"
                  >
                    <svg className="h-3.5 w-3.5 flex-shrink-0 text-ink-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="min-w-0 flex-1 truncate text-xs text-ink">{n.title || "未命名便签"}</span>
                    <span className="flex-shrink-0 text-[11px] text-ink-muted">
                      {n.createdAt && toDateStr(new Date(n.createdAt)) === dateStr ? "今天创建" : "今天更新"}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
