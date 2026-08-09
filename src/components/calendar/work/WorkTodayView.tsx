"use client";

import { useMemo } from "react";
import type { Note, WorkProjectColor, WorkScheduleItem } from "@/types";
import { addDays, fromDateStr, toDateStr, weekdayLabel } from "@/lib/calendar-date";
import { futureKeyNodes } from "@/lib/schedule-nodes";
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
      className={`group rounded-btn border border-border-light bg-surface-strong/60 px-2 py-1.5 text-left transition-colors hover:bg-surface-hover ${wpClass(colorOf(item.projectId))}`}
      style={{ borderLeftWidth: 4, borderLeftColor: "var(--wp-base)" }}
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

  // QA⑥ 后续关键节点：从明天起 14 天，最多 3 条，交付/提交类优先（与封面共享关键词判定）。
  const nextNodes = useMemo(
    () => futureKeyNodes(items, toDateStr(addDays(date, 1)), 14, 3),
    [items, dateStr]
  );

  const emptyAll = todayRanges.length === 0 && todayNodes.length === 0 && todayNotes.length === 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 px-0.5">
        <h2 className="text-base font-bold text-ink">
          {MONTH_NAMES[date.getMonth()]}月{date.getDate()}日
          <span className={`ml-1 text-xs font-semibold ${weekend ? "text-accent-pink" : "text-ink-muted"}`}>
            · {weekday}
          </span>
        </h2>
        {isToday && <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-white">今天</span>}
      </div>

      {/* 2.3 当天摘要：紧凑计数，排期少时下方不空荡 */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-0.5 text-[11px] text-ink-muted">
        <span>排期 {todayRanges.length + todayNodes.length} 项</span>
        {showNoteLayer && <span>关联便签 {todayNotes.length} 条</span>}
      </div>

      {/* QA⑥ 后续关键节点提示：点击跳转到该排期详情 */}
      {nextNodes.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <SectionTitle label="后续关键节点" />
          <div className="flex flex-col gap-1.5">
            {nextNodes.map((n) => {
              const offset = Math.round(
                (fromDateStr(n.dateStr).getTime() - fromDateStr(dateStr).getTime()) / 86400000
              );
              const dd = fromDateStr(n.dateStr);
              return (
                <button
                  key={n.item.id}
                  type="button"
                  onClick={() => onItemClick(n.item)}
                  className="flex items-center gap-2 rounded-btn border border-border-light bg-panel-bg px-2 py-1.5 text-left transition-colors hover:bg-surface-hover"
                >
                  <span className="flex-shrink-0 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-600">
                    {isToday
                      ? offset === 1
                        ? "明天"
                        : offset === 2
                          ? "后天"
                          : `${offset} 天后`
                      : `${dd.getMonth() + 1}/${dd.getDate()}`}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-ink">
                    {n.item.title || "未命名"}
                  </span>
                  <svg
                    className="h-3 w-3 flex-shrink-0 text-ink-muted"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {emptyAll ? (
        <div className="rounded-btn border border-dashed border-border-light bg-panel-bg/40 px-3 py-6 text-center text-sm text-ink-muted">
          {isToday ? "今天还没有排期" : "当天暂无排期"}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* 今天要做 / 当天要做：进行中的连续阶段 */}
          <div className="flex flex-col gap-1.5">
            <SectionTitle label={isToday ? "今天要做" : "当天要做"} />
            {todayRanges.length === 0 ? (
              <Empty text="暂无" />
            ) : (
              <div className="grid gap-1.5 sm:grid-cols-2">
                {todayRanges.map((it) => (
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
                    <div className="min-w-0 flex-1">
                      <TodayItemCard
                        item={it}
                        colorOf={colorOf}
                        projectNameOf={projectNameOf}
                        showNoteLayer={showNoteLayer}
                        sub="阶段中"
                        onClick={() => onItemClick(it)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 今天节点 + 今天编辑的便签：宽屏分两栏；便签层关闭时节点区独占整行 */}
          <div className={showNoteLayer ? "grid gap-4 sm:grid-cols-2" : "flex flex-col gap-1.5"}>
            {/* 今天节点 / 当天节点 */}
            <div className="flex flex-col gap-1.5">
              <SectionTitle label={isToday ? "今天节点" : "当天节点"} />
              {todayNodes.length === 0 ? (
                <Empty text="暂无" />
              ) : (
                <div className="grid gap-1.5">
                  {todayNodes.map((it) => (
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
                      <div className="min-w-0 flex-1">
                        <TodayItemCard
                          item={it}
                          colorOf={colorOf}
                          projectNameOf={projectNameOf}
                          showNoteLayer={showNoteLayer}
                          sub="节点"
                          onClick={() => onItemClick(it)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 今天编辑的便签 / 当天编辑的便签（便签链接层，受开关控制；关闭时整块隐藏） */}
            {showNoteLayer && (
              <div className="flex flex-col gap-1.5">
                <SectionTitle label={isToday ? "今天编辑的便签" : "当天编辑的便签"} />
                {todayNotes.length === 0 ? (
                  <Empty text="暂无" />
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
                          {n.createdAt && toDateStr(new Date(n.createdAt)) === dateStr
                            ? isToday
                              ? "今天创建"
                              : "当天创建"
                            : isToday
                              ? "今天更新"
                              : "当天更新"}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
