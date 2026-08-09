"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  WorkProject,
  WorkProjectColor,
  WorkScheduleItem,
  WorkScheduleItemInput,
} from "@/types";
import EventNotePicker from "../EventNotePicker";
import { wpClass } from "./color";

interface Props {
  /** active 项目（表单项目下拉）。 */
  projects: WorkProject[];
  /** 全部项目（含归档），用于解析条目所属项目名。 */
  allProjects: WorkProject[];
  selectedProject: WorkProject | null;
  selectedItem: WorkScheduleItem | null;
  /** 全部排期（当前拉取范围），项目详情用。 */
  items: WorkScheduleItem[];
  todayStr: string;
  colorOf: (projectId: string) => WorkProjectColor;
  /** 自增：重置表单为「新建」态。 */
  newItemNonce: number;
  onEditProject: () => void;
  onArchiveProject: (p: WorkProject) => void;
  onRestoreProject: (p: WorkProject) => void;
  onDeleteProject: (p: WorkProject) => void;
  onCreateItem: (input: WorkScheduleItemInput) => Promise<void>;
  onUpdateItem: (id: string, input: WorkScheduleItemInput) => Promise<void>;
  onDeleteItem: (id: string) => Promise<void>;
  onItemClick: (item: WorkScheduleItem) => void;
  /** 项目详情内「+ 新增排期」：切到该项目并重置表单。 */
  onAddItem: (projectId: string) => void;
}

const STATUS_OPTIONS: { value: WorkScheduleItemInput["status"]; label: string }[] = [
  { value: "todo", label: "待完成" },
  { value: "done", label: "已完成" },
  { value: "postponed", label: "已延期" },
];

const inputCls =
  "w-full px-2.5 py-1.5 text-sm text-ink bg-panel-bg border border-border-light rounded-input outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15 transition-all";

function shortDate(s: string): string {
  const [, m, d] = s.split("-");
  return `${parseInt(m, 10)}/${parseInt(d, 10)}`;
}

function ProjectStatusBadge({ project, items, todayStr }: { project: WorkProject; items: WorkScheduleItem[]; todayStr: string }) {
  if (project.status === "archived") return <span className="rounded-full bg-surface-hover px-1.5 py-0.5 text-[10px] font-bold text-ink-muted">已归档</span>;
  const its = items.filter((i) => i.projectId === project.id);
  const allEnded = its.length > 0 && its.every((i) => i.endDate < todayStr);
  return allEnded ? (
    <span className="rounded-full bg-danger/10 px-1.5 py-0.5 text-[10px] font-bold text-danger">已结束待归档</span>
  ) : (
    <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">进行中</span>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 border-t border-border-light/60 py-1.5 text-xs first:border-t-0 first:pt-0">
      <span className="flex-shrink-0 text-ink-muted">{label}</span>
      <strong className="min-w-0 truncate text-right text-ink-secondary font-semibold">{value}</strong>
    </div>
  );
}

export default function WorkRightPanel({
  projects,
  allProjects,
  selectedProject,
  selectedItem,
  items,
  todayStr,
  colorOf,
  newItemNonce,
  onEditProject,
  onArchiveProject,
  onRestoreProject,
  onDeleteProject,
  onCreateItem,
  onUpdateItem,
  onDeleteItem,
  onItemClick,
  onAddItem,
}: Props) {
  const [projectId, setProjectId] = useState("");
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"range" | "node">("range");
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [status, setStatus] = useState<WorkScheduleItemInput["status"]>("todo");
  const [noteId, setNoteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editing = Boolean(selectedItem);

  // 表单状态：selectedItem 变化 → 加载该条目；否则 newItemNonce 自增 → 重置为新建态。
  useEffect(() => {
    setError(null);
    setSaving(false);
    if (selectedItem) {
      setProjectId(selectedItem.projectId);
      setTitle(selectedItem.title);
      setType(selectedItem.type);
      setStartDate(selectedItem.startDate);
      setEndDate(selectedItem.endDate);
      setStatus(selectedItem.status);
      setNoteId(selectedItem.noteId);
    } else {
      const pid =
        (selectedProject && projects.some((p) => p.id === selectedProject.id) ? selectedProject.id : null) ??
        projects[0]?.id ??
        "";
      setProjectId(pid);
      setTitle("");
      setType("range");
      setStartDate(todayStr);
      setEndDate(todayStr);
      setStatus("todo");
      setNoteId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedItem, newItemNonce]);

  const detailProject = useMemo(() => {
    if (selectedProject) return selectedProject;
    if (selectedItem) return allProjects.find((p) => p.id === selectedItem.projectId) ?? null;
    return null;
  }, [selectedProject, selectedItem, allProjects]);

  const projectItems = useMemo(() => {
    if (!detailProject) return [];
    return items
      .filter((it) => it.projectId === detailProject.id)
      .sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0));
  }, [items, detailProject]);

  const currentRange = useMemo(
    () => projectItems.find((it) => it.type === "range" && it.startDate <= todayStr && it.endDate >= todayStr && it.status !== "done"),
    [projectItems, todayStr]
  );
  const nextNode = useMemo(
    () =>
      projectItems
        .filter((it) => it.type === "node" && it.startDate >= todayStr && it.status !== "done")
        .sort((a, b) => (a.startDate < b.startDate ? -1 : 1))[0],
    [projectItems, todayStr]
  );
  const latestEnd = useMemo(
    () => projectItems.reduce((max, it) => (it.endDate > max ? it.endDate : max), ""),
    [projectItems]
  );

  const noProjects = projects.length === 0;

  const handleSave = async () => {
    const t = title.trim();
    if (!t) return setError("请输入标题");
    if (!projectId) return setError("请选择所属项目");
    if (!startDate) return setError("请选择开始日期");
    if (type === "range" && endDate && startDate > endDate) return setError("结束日期不能早于开始日期");
    const input: WorkScheduleItemInput = {
      projectId,
      title: t,
      type,
      startDate,
      endDate: type === "node" ? startDate : endDate || startDate,
      status,
      noteId,
    };
    setSaving(true);
    setError(null);
    try {
      if (selectedItem) await onUpdateItem(selectedItem.id, input);
      else await onCreateItem(input);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedItem) return;
    if (!window.confirm(`删除排期「${selectedItem.title}」？此操作不会删除关联便签。`)) return;
    setSaving(true);
    setError(null);
    try {
      await onDeleteItem(selectedItem.id);
    } catch {
      setError("删除失败");
      setSaving(false);
    }
  };

  return (
    <aside className="flex h-full min-h-0 w-full flex-col overflow-y-auto border-l border-border-light bg-sidebar-bg scrollbar-thin">
      {/* 项目详情 */}
      <div className="flex flex-shrink-0 items-center justify-between px-3 pb-1 pt-3">
        <h2 className="text-[13px] font-bold text-ink">项目详情</h2>
        {detailProject && (
          <button
            type="button"
            onClick={onEditProject}
            className="rounded-btn px-1.5 py-0.5 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
          >
            编辑项目
          </button>
        )}
      </div>
      {detailProject ? (
        <div className="mx-3 flex flex-shrink-0 flex-col rounded-card border border-border-light bg-surface-strong/40 p-2.5">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 flex-shrink-0 rounded-full wp-dot ${wpClass(detailProject.colorKey)}`} />
            <span className="min-w-0 truncate text-sm font-bold text-ink">{detailProject.name || "未命名项目"}</span>
            <ProjectStatusBadge project={detailProject} items={items} todayStr={todayStr} />
          </div>
          <div className="mt-1">
            <DetailRow label="状态" value={detailProject.status === "archived" ? "已归档" : currentRange ? `进行中 · ${currentRange.title}` : nextNode ? "即将进行" : latestEnd ? "已结束" : "待排期"} />
            <DetailRow label="连续阶段" value={`${projectItems.filter((i) => i.type === "range").length} 条`} />
            <DetailRow label="提交会议节点" value={`${projectItems.filter((i) => i.type === "node").length} 个`} />
            <DetailRow label="最近结束" value={latestEnd ? shortDate(latestEnd) : "未设置"} />
          </div>

          <div className="mt-1.5 flex items-center gap-1.5">
            {detailProject.status === "archived" ? (
              <button
                type="button"
                onClick={() => onRestoreProject(detailProject)}
                className="rounded-btn px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10 transition-colors"
              >
                恢复
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onArchiveProject(detailProject)}
                className="rounded-btn px-2 py-1 text-xs font-semibold text-ink-secondary hover:bg-surface-hover hover:text-ink transition-colors"
              >
                归档
              </button>
            )}
            <button
              type="button"
              onClick={() => onDeleteProject(detailProject)}
              className="rounded-btn px-2 py-1 text-xs font-semibold text-danger hover:bg-danger/10 transition-colors"
            >
              删除
            </button>
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => onAddItem(detailProject.id)}
              className="rounded-btn px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10 transition-colors"
            >
              + 新增排期
            </button>
          </div>

          {projectItems.length > 0 && (
            <div className="mt-2 flex flex-col border-t border-border-light/60 pt-1.5">
              {projectItems.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => onItemClick(it)}
                  className="flex items-center gap-1.5 rounded-btn px-1.5 py-1 text-left transition-colors hover:bg-surface-hover"
                >
                  <span className={`flex-shrink-0 ${it.type === "node" ? "h-1.5 w-1.5 rounded-full wp-dot" : "h-1 w-3 rounded-sm wp-dot"} ${wpClass(detailProject.colorKey)}`} />
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-xs ${it.status === "done" ? "text-ink-muted line-through" : "text-ink"}`}>{it.title}</span>
                    <span className="block text-[10px] text-ink-muted">
                      {shortDate(it.startDate)}
                      {it.type === "range" && it.endDate !== it.startDate ? ` - ${shortDate(it.endDate)}` : ""}
                      {it.type === "range" ? " · 阶段" : " · 节点"}
                      {it.status === "postponed" ? " · 已延期" : ""}
                    </span>
                  </span>
                  {it.noteId && (
                    <svg className="h-3 w-3 flex-shrink-0 text-ink-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="mx-3 flex-shrink-0 rounded-card border border-dashed border-border-light p-3 text-xs leading-relaxed text-ink-muted">
          在月/周/今日视图或上方筛选里选择一个项目，这里显示项目详情。
        </div>
      )}

      {/* 手动添加 / 修正 */}
      <div className="flex flex-shrink-0 items-center justify-between px-3 pb-1 pt-3">
        <h2 className="text-[13px] font-bold text-ink">{editing ? "手动修正" : "手动添加"}</h2>
        {editing && <span className="max-w-[60%] truncate text-[10px] text-ink-muted">正在修改：{selectedItem?.title}</span>}
      </div>
      <div className="mx-3 flex flex-shrink-0 flex-col gap-2.5 pb-1">
        {noProjects ? (
          <div className="rounded-card bg-danger/10 px-3 py-3 text-sm text-danger">还没有工作项目，请先新增项目再添加排期。</div>
        ) : (
          <>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-muted">标题</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例如：A 修改 / V1 提交&反馈"
                maxLength={120}
                className={inputCls}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-muted">项目</label>
                <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={inputCls}>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-muted">类型</label>
                <select
                  value={type}
                  onChange={(e) => {
                    const v = e.target.value as "range" | "node";
                    setType(v);
                    if (v === "node") setEndDate(startDate);
                  }}
                  className={inputCls}
                >
                  <option value="range">连续阶段</option>
                  <option value="node">单日节点</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-muted">开始日期</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    if (type === "node") setEndDate(e.target.value);
                  }}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-muted">结束日期</label>
                <input
                  type="date"
                  value={type === "node" ? startDate : endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  disabled={type === "node"}
                  className={`${inputCls} ${type === "node" ? "opacity-50" : ""}`}
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-muted">状态</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as WorkScheduleItemInput["status"])} className={inputCls}>
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <EventNotePicker value={noteId} onChange={setNoteId} noteTitle={selectedItem?.note?.title ?? null} />

            {error && <p className="text-xs text-danger">{error}</p>}

            <div className="flex items-center gap-2">
              {editing && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={saving}
                  className="rounded-btn px-2.5 py-1.5 text-sm font-semibold text-danger hover:bg-danger/10 transition-colors disabled:opacity-50"
                >
                  {saving ? "删除中..." : "删除"}
                </button>
              )}
              <div className="flex-1" />
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-btn bg-primary px-3.5 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? "保存中..." : "保存"}
              </button>
            </div>
            <p className="pb-1 text-[11px] leading-relaxed text-ink-muted/70">
              点选月/周/今日里的任一条即可修改；新增排期也走同一个表单。
            </p>
          </>
        )}
      </div>

      {/* 后续导入入口 */}
      <div className="flex flex-shrink-0 items-center px-3 pb-1 pt-3">
        <h2 className="text-[13px] font-bold text-ink">后续导入入口</h2>
      </div>
      <div className="mx-3 mb-3 flex flex-col gap-2">
        <div className="rounded-card border border-border-light bg-surface-strong/40 p-2.5">
          <div className="text-xs font-bold leading-[1.35] text-ink">Excel / PDF / 图片导入暂不作为第一版主流程</div>
          <div className="mt-0.5 text-[11px] leading-[1.35] text-ink-muted">先跑通人工新增、修正、归档；AI 后续只生成草稿，不直接写入正式日历。</div>
        </div>
        <div className="rounded-card border border-border-light bg-surface-strong/40 p-2.5">
          <div className="text-xs font-bold leading-[1.35] text-ink">示例草稿：ACO 修改 8/20 - 8/21</div>
          <div className="mt-0.5 text-[11px] leading-[1.35] text-ink-muted">未来导入后会进入待确认列表，点选后仍用上面的手动表单修正。</div>
        </div>
      </div>
    </aside>
  );
}
