"use client";

import { useEffect, useState } from "react";
import type {
  WorkProject,
  WorkScheduleItem,
  WorkScheduleItemInput,
  CalendarImportDraft,
  CalendarImportUsage,
} from "@/types";
import EventNotePicker from "../EventNotePicker";
import ImportPreviewPanel from "./ImportPreviewPanel";
import { wpClass } from "./color";

interface Props {
  /** active 项目（表单项目下拉）。 */
  projects: WorkProject[];
  /** 新建态预选项目。 */
  selectedProject: WorkProject | null;
  /** 非 null → 项目详情模式（点击项目 chip 名称时）。 */
  detailProject?: WorkProject | null;
  /** 项目详情：该项目排期数量。 */
  detailItemCount?: number;
  /** 项目详情：生命周期标签（进行中/已结束/已归档）。 */
  detailLifecycle?: "active" | "ended" | "archived";
  selectedItem: WorkScheduleItem | null;
  todayStr: string;
  /** 自增：重置表单为「新建」态。 */
  newItemNonce: number;
  onCreateItem: (input: WorkScheduleItemInput) => Promise<void>;
  onUpdateItem: (id: string, input: WorkScheduleItemInput) => Promise<void>;
  onDeleteItem: (id: string) => Promise<void>;
  /** 项目详情动作。 */
  onEditProject?: (p: WorkProject) => void;
  onArchiveProject?: (p: WorkProject) => void;
  onRestoreProject?: (p: WorkProject) => void;
  onDeleteProject?: (p: WorkProject) => void;
  onAddItemToProject?: (p: WorkProject) => void;
  /** 「＋ 新增项目」：打开新增项目弹窗。 */
  onNewProject: () => void;
  /** 取消：关闭新建面板 / 取消选中回到新建态。 */
  onCancel: () => void;
  /** M13 AI 导入。 */
  importDraft?: CalendarImportDraft | null;
  importUsage?: CalendarImportUsage | null;
  importBusy?: boolean;
  importError?: string | null;
  importDoneMessage?: string | null;
  onParseFile: (file: File, kind: "image" | "excel") => void;
  onUpdateDraft: (draft: CalendarImportDraft) => void;
  onConfirmImport: () => void;
  onCancelImport: () => void;
}

const inputCls =
  "w-full px-2.5 py-1.5 text-sm text-ink bg-panel-bg border border-border-light rounded-input outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15 transition-all";

export default function WorkRightPanel({
  projects,
  selectedProject,
  detailProject,
  detailItemCount = 0,
  detailLifecycle = "active",
  selectedItem,
  todayStr,
  newItemNonce,
  onCreateItem,
  onUpdateItem,
  onDeleteItem,
  onEditProject,
  onArchiveProject,
  onRestoreProject,
  onDeleteProject,
  onAddItemToProject,
  onNewProject,
  onCancel,
  importDraft,
  importUsage,
  importBusy,
  importError,
  importDoneMessage,
  onParseFile,
  onUpdateDraft,
  onConfirmImport,
  onCancelImport,
}: Props) {
  const [projectId, setProjectId] = useState("");
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [noteId, setNoteId] = useState<string | null>(null);
  const [status, setStatus] = useState<"todo" | "done">("todo");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editing = Boolean(selectedItem);
  const detailMode = Boolean(detailProject && !selectedItem);

  // 表单状态：selectedItem 变化 → 加载该条目；否则 newItemNonce 自增 → 重置为新建态。
  // 项目详情模式下不初始化表单（表单不渲染）。
  useEffect(() => {
    setError(null);
    setSaving(false);
    if (selectedItem) {
      setProjectId(selectedItem.projectId);
      setTitle(selectedItem.title);
      setStartDate(selectedItem.startDate);
      setEndDate(selectedItem.endDate);
      setNoteId(selectedItem.noteId);
      setStatus(selectedItem.status === "done" ? "done" : "todo");
    } else if (!detailProject) {
      const pid =
        (selectedProject && projects.some((p) => p.id === selectedProject.id) ? selectedProject.id : null) ??
        projects[0]?.id ??
        "";
      setProjectId(pid);
      setTitle("");
      setStartDate(todayStr);
      setEndDate(todayStr);
      setNoteId(null);
      setStatus("todo");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedItem, newItemNonce, detailProject]);

  const noProjects = projects.length === 0;

  const handleSave = async () => {
    const t = title.trim();
    if (!t) return setError("请输入标题");
    if (!projectId) return setError("请选择所属项目");
    if (!startDate) return setError("请选择开始日期");
    const end = endDate || startDate;
    if (end < startDate) return setError("结束日期不能早于开始日期");
    // 类型由日期范围自动判定：单日 → node；多日 → range
    const type = startDate === end ? "node" : "range";
    const input: WorkScheduleItemInput = {
      projectId,
      title: t,
      type,
      startDate,
      endDate: end,
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

  const handlePickFile = (e: React.ChangeEvent<HTMLInputElement>, kind: "image" | "excel") => {
    const f = e.target.files?.[0];
    if (f) onParseFile(f, kind);
    e.target.value = "";
  };

  return (
    <aside className="flex h-full min-h-0 w-full flex-col overflow-y-auto border-l border-border-light bg-sidebar-bg scrollbar-thin">
      {importDraft ? (
        <ImportPreviewPanel
          draft={importDraft}
          usage={importUsage}
          busy={importBusy}
          error={importError}
          onUpdateDraft={onUpdateDraft}
          onConfirm={onConfirmImport}
          onCancel={onCancelImport}
        />
      ) : detailMode && detailProject ? (
        <ProjectDetail
          project={detailProject}
          itemCount={detailItemCount}
          lifecycle={detailLifecycle}
          onEditProject={onEditProject}
          onArchiveProject={onArchiveProject}
          onRestoreProject={onRestoreProject}
          onDeleteProject={onDeleteProject}
          onAddItemToProject={onAddItemToProject}
          onCancel={onCancel}
        />
      ) : (
        <>
          {/* 添加排期 / 编辑排期 */}
          <div className="flex flex-shrink-0 items-center justify-between px-3 pb-1 pt-3">
            <h2 className="text-[13px] font-bold text-ink">{editing ? "编辑排期" : "添加排期"}</h2>
            {editing && <span className="max-w-[60%] truncate text-[10px] text-ink-muted">正在修改：{selectedItem?.title}</span>}
          </div>
          <div className="mx-3 flex flex-shrink-0 flex-col gap-2.5 pb-1">
            {noProjects ? (
              <div className="rounded-card bg-danger/10 px-3 py-3 text-sm text-danger">暂无项目</div>
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
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-muted">所属项目</label>
                  <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={inputCls}>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-ink-muted">开始日期</label>
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-ink-muted">结束日期</label>
                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-muted">状态</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as "todo" | "done")}
                    className={inputCls}
                  >
                    <option value="todo">未完成</option>
                    <option value="done">已完成</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-muted">关联便签（可选）</label>
                  <EventNotePicker value={noteId} onChange={setNoteId} noteTitle={selectedItem?.note?.title ?? null} />
                </div>

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
                    onClick={onCancel}
                    disabled={saving}
                    className="rounded-btn px-3 py-1.5 text-sm font-semibold text-ink-secondary hover:bg-surface-hover transition-colors disabled:opacity-50"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="rounded-btn bg-primary px-3.5 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
                  >
                    {saving ? "保存中..." : "保存"}
                  </button>
                </div>
              </>
            )}
          </div>

          {noProjects && (
            <button
              type="button"
              onClick={onNewProject}
              className="mx-3 mt-1 flex-shrink-0 rounded-btn bg-primary px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
            >
              + 新增项目
            </button>
          )}

          {/* M13 AI 导入：辅助生成草稿，弱于手动添加 */}
          <div className="mx-3 mb-3 mt-2 flex-shrink-0 border-t border-border-light pt-2">
            <p className="mb-1.5 text-xs font-medium text-ink-muted">导入排期</p>
            <div className="flex items-center gap-1.5">
              <label className="cursor-pointer rounded-btn border border-border-light bg-panel-bg px-3 py-1.5 text-xs font-semibold text-ink-secondary transition-colors hover:bg-surface-hover hover:text-ink disabled:opacity-50">
                上传图片
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  disabled={importBusy}
                  onChange={(e) => handlePickFile(e, "image")}
                />
              </label>
              <label className="cursor-pointer rounded-btn border border-border-light bg-panel-bg px-3 py-1.5 text-xs font-semibold text-ink-secondary transition-colors hover:bg-surface-hover hover:text-ink disabled:opacity-50">
                上传 Excel
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  disabled={importBusy}
                  onChange={(e) => handlePickFile(e, "excel")}
                />
              </label>
            </div>
            {importBusy && <p className="mt-1.5 text-xs text-ink-muted">识别中...</p>}
            {importError && !importBusy && <p className="mt-1.5 text-xs text-danger">{importError}</p>}
            {importDoneMessage && <p className="mt-1.5 text-xs text-success">✓ {importDoneMessage}</p>}
          </div>
        </>
      )}
    </aside>
  );
}

function ProjectDetail({
  project,
  itemCount,
  lifecycle,
  onEditProject,
  onArchiveProject,
  onRestoreProject,
  onDeleteProject,
  onAddItemToProject,
  onCancel,
}: {
  project: WorkProject;
  itemCount: number;
  lifecycle: "active" | "ended" | "archived";
  onEditProject?: (p: WorkProject) => void;
  onArchiveProject?: (p: WorkProject) => void;
  onRestoreProject?: (p: WorkProject) => void;
  onDeleteProject?: (p: WorkProject) => void;
  onAddItemToProject?: (p: WorkProject) => void;
  onCancel?: () => void;
}) {
  const archived = lifecycle === "archived";
  const statusLabel = archived ? "已归档" : lifecycle === "ended" ? "已结束" : "进行中";
  return (
    <div className="flex flex-col gap-3 px-3 pt-3">
      <div className="flex items-center gap-2">
        <span className={`h-3.5 w-3.5 flex-shrink-0 rounded-full wp-dot ${wpClass(project.colorKey)}`} />
        <h2 className="min-w-0 truncate text-[13px] font-bold text-ink">{project.name || "未命名项目"}</h2>
        <span className="flex-shrink-0 rounded-full bg-surface-strong px-1.5 py-0.5 text-[10px] font-semibold text-ink-secondary">
          {statusLabel}
        </span>
      </div>

      <div className="text-xs text-ink-secondary">
        时间：{project.startDate && project.endDate ? `${project.startDate} ~ ${project.endDate}` : "未设置时间"}
      </div>

      {project.description ? (
        <p className="text-xs leading-relaxed text-ink-muted">{project.description}</p>
      ) : null}

      <div className="text-xs text-ink-muted">{itemCount} 条排期</div>

      <div className="flex flex-col gap-1.5 pt-1">
        {onAddItemToProject && (
          <button
            type="button"
            onClick={() => onAddItemToProject(project)}
            className="flex items-center gap-1 rounded-btn bg-primary px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m-7-7h14" />
            </svg>
            ＋ 添加排期
          </button>
        )}
        {onEditProject && (
          <button
            type="button"
            onClick={() => onEditProject(project)}
            className="rounded-btn border border-border-light bg-panel-bg px-3 py-1.5 text-sm font-semibold text-ink-secondary transition-colors hover:bg-surface-hover hover:text-ink"
          >
            编辑项目
          </button>
        )}
        {onArchiveProject && !archived && (
          <button
            type="button"
            onClick={() => onArchiveProject(project)}
            className="rounded-btn border border-border-light bg-panel-bg px-3 py-1.5 text-sm font-semibold text-ink-secondary transition-colors hover:bg-surface-hover hover:text-ink"
          >
            归档项目
          </button>
        )}
        {onRestoreProject && archived && (
          <button
            type="button"
            onClick={() => onRestoreProject(project)}
            className="rounded-btn border border-border-light bg-panel-bg px-3 py-1.5 text-sm font-semibold text-primary transition-colors hover:bg-surface-hover"
          >
            恢复项目
          </button>
        )}
        {onDeleteProject && (
          <button
            type="button"
            onClick={() => onDeleteProject(project)}
            className="rounded-btn px-3 py-1.5 text-sm font-semibold text-danger transition-colors hover:bg-danger/10"
          >
            删除项目
          </button>
        )}
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-btn px-3 py-1.5 text-sm font-semibold text-ink-secondary transition-colors hover:bg-surface-hover"
          >
            取消
          </button>
        )}
      </div>
    </div>
  );
}
