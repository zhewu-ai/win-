"use client";

import type { WorkProject, WorkScheduleItem } from "@/types";
import { wpClass } from "./color";

interface Props {
  project: WorkProject;
  /** 该项目全部排期条目（当前拉取范围内）。 */
  items: WorkScheduleItem[];
  todayStr: string;
  onClose: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onDelete: () => void;
  onNewItem: (date: string) => void;
  onItemClick: (item: WorkScheduleItem) => void;
}

function shortDate(s: string): string {
  const [, m, d] = s.split("-");
  return `${parseInt(m, 10)}/${parseInt(d, 10)}`;
}

export default function WorkProjectSidePanel({
  project,
  items,
  todayStr,
  onClose,
  onEdit,
  onArchive,
  onRestore,
  onDelete,
  onNewItem,
  onItemClick,
}: Props) {
  const archived = project.status === "archived";
  const sorted = [...items].sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0));
  const currentRange = sorted.find((it) => it.type === "range" && it.startDate <= todayStr && it.endDate >= todayStr && it.status !== "done");
  const nextNode = sorted
    .filter((it) => it.type === "node" && it.startDate >= todayStr && it.status !== "done")
    .sort((a, b) => (a.startDate < b.startDate ? -1 : 1))[0];

  return (
    <aside className="flex flex-col h-full min-h-0 w-full border-l border-border-light bg-sidebar-bg overflow-y-auto scrollbar-thin">
      {/* 头部 */}
      <div className="flex items-start gap-2 px-3 pt-3 pb-2 flex-shrink-0">
        <span className={`mt-1 flex-shrink-0 w-2.5 h-2.5 rounded-full wp-dot ${wpClass(project.colorKey)}`} aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <h3 className="text-[15px] leading-tight font-bold text-ink truncate">{project.name || "未命名项目"}</h3>
          <span className="mt-1 inline-block px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-surface-hover text-ink-muted">
            {archived ? "已归档" : "进行中"}
          </span>
        </div>
        <button
          onClick={onClose}
          className="flex-shrink-0 p-1 text-ink-muted hover:text-ink rounded-btn transition-colors"
          aria-label="关闭项目详情"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* 基本信息 */}
      <div className="px-3 pb-2 text-xs text-ink-muted space-y-1">
        <div>
          时间范围：
          {project.startDate || project.endDate
            ? `${project.startDate ? shortDate(project.startDate) : "—"} ~ ${project.endDate ? shortDate(project.endDate) : "—"}`
            : "未设置"}
        </div>
        {project.description && <div className="text-ink-secondary whitespace-pre-wrap break-words">{project.description}</div>}
      </div>

      <div className="mx-3 my-1 border-t border-border-light/60" />

      {/* 当前阶段 / 下一节点 */}
      <div className="px-3 space-y-2 text-sm">
        {currentRange && (
          <div className="flex items-start gap-2">
            <span className={`mt-0.5 flex-shrink-0 w-1 h-3.5 rounded-sm wp-dot ${wpClass(project.colorKey)}`} aria-hidden="true" />
            <div className="min-w-0">
              <div className="text-[11px] text-ink-muted">当前阶段</div>
              <div className="text-ink truncate">{currentRange.title}</div>
              <div className="text-xs text-ink-muted">
                {shortDate(currentRange.startDate)} - {shortDate(currentRange.endDate)}
              </div>
            </div>
          </div>
        )}
        {nextNode && (
          <div className="flex items-start gap-2">
            <span className={`mt-0.5 flex-shrink-0 w-1.5 h-1.5 rounded-full wp-dot ${wpClass(project.colorKey)}`} aria-hidden="true" />
            <div className="min-w-0">
              <div className="text-[11px] text-ink-muted">下一节点</div>
              <div className="text-ink truncate">{nextNode.title}</div>
              <div className="text-xs text-ink-muted">{shortDate(nextNode.startDate)}</div>
            </div>
          </div>
        )}
      </div>

      <div className="mx-3 my-1 border-t border-border-light/60" />

      {/* 排期条目 */}
      <div className="flex items-center justify-between px-3 pb-1">
        <span className="text-[13px] font-bold text-ink-muted">排期条目</span>
        <button
          onClick={() => onNewItem(todayStr)}
          className="text-xs font-medium text-primary hover:bg-primary/10 rounded-btn px-1.5 py-0.5 transition-colors"
        >
          + 新增排期
        </button>
      </div>
      <div className="px-2 pb-2 space-y-0.5">
        {sorted.length === 0 && <p className="px-1 py-2 text-xs text-ink-muted">还没有排期条目，点击「+ 新增排期」添加。</p>}
        {sorted.map((it) => (
          <button
            key={it.id}
            type="button"
            onClick={() => onItemClick(it)}
            className="flex w-full items-center gap-1.5 px-2 py-1.5 rounded-btn hover:bg-surface-hover transition-colors text-left"
          >
            <span className={`flex-shrink-0 ${it.type === "node" ? "w-1.5 h-1.5 rounded-full wp-dot" : "w-1 h-3 rounded-sm wp-dot"} ${wpClass(project.colorKey)}`} aria-hidden="true" />
            <span className="flex-1 min-w-0">
              <span className={`block text-sm truncate ${it.status === "done" ? "line-through opacity-50 text-ink-muted" : "text-ink"}`}>
                {it.title}
              </span>
              <span className="block text-[11px] text-ink-muted">
                {shortDate(it.startDate)}
                {it.type === "range" && it.endDate !== it.startDate ? ` - ${shortDate(it.endDate)}` : ""}
                {it.type === "range" ? " · 阶段" : " · 节点"}
                {it.status === "postponed" ? " · 已延期" : ""}
              </span>
            </span>
            {it.note && (
              <svg className="w-3.5 h-3.5 flex-shrink-0 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            )}
          </button>
        ))}
      </div>

      {/* 操作 */}
      <div className="mt-auto px-3 py-3 border-t border-border-light/60 flex items-center gap-2">
        <button
          onClick={onEdit}
          className="px-2.5 py-1.5 rounded-btn text-sm font-semibold text-ink-secondary hover:text-ink hover:bg-surface-hover transition-colors"
        >
          编辑
        </button>
        <button
          onClick={archived ? onRestore : onArchive}
          className={`px-2.5 py-1.5 rounded-btn text-sm font-semibold transition-colors ${
            archived ? "text-primary hover:bg-primary/10" : "text-ink-secondary hover:text-ink hover:bg-surface-hover"
          }`}
        >
          {archived ? "恢复" : "归档"}
        </button>
        <div className="flex-1" />
        <button onClick={onDelete} className="px-2.5 py-1.5 rounded-btn text-sm font-semibold text-danger hover:bg-danger/10 transition-colors">
          删除
        </button>
      </div>
    </aside>
  );
}
