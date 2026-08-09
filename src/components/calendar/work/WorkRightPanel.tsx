"use client";

import { useEffect, useState } from "react";
import type { WorkProject, WorkScheduleItem, WorkScheduleItemInput } from "@/types";
import EventNotePicker from "../EventNotePicker";

interface Props {
  /** active 项目（表单项目下拉）。 */
  projects: WorkProject[];
  /** 新建态预选项目。 */
  selectedProject: WorkProject | null;
  selectedItem: WorkScheduleItem | null;
  todayStr: string;
  /** 自增：重置表单为「新建」态。 */
  newItemNonce: number;
  /** 新建态默认类型（工具栏「添加连续阶段/添加单日节点」传入）。 */
  presetType: "range" | "node";
  onCreateItem: (input: WorkScheduleItemInput) => Promise<void>;
  onUpdateItem: (id: string, input: WorkScheduleItemInput) => Promise<void>;
  onDeleteItem: (id: string) => Promise<void>;
  /** 「＋ 新增项目」：打开新增项目弹窗。 */
  onNewProject: () => void;
  /** 取消：关闭新建面板 / 取消选中回到新建态。 */
  onCancel: () => void;
}

const inputCls =
  "w-full px-2.5 py-1.5 text-sm text-ink bg-panel-bg border border-border-light rounded-input outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15 transition-all";

export default function WorkRightPanel({
  projects,
  selectedProject,
  selectedItem,
  todayStr,
  newItemNonce,
  onCreateItem,
  onUpdateItem,
  onDeleteItem,
  onNewProject,
  onCancel,
  presetType,
}: Props) {
  const [projectId, setProjectId] = useState("");
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"range" | "node">("range");
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
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
      setNoteId(selectedItem.noteId);
    } else {
      const pid =
        (selectedProject && projects.some((p) => p.id === selectedProject.id) ? selectedProject.id : null) ??
        projects[0]?.id ??
        "";
      setProjectId(pid);
      setTitle("");
      setType(presetType);
      setStartDate(todayStr);
      setEndDate(todayStr);
      setNoteId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedItem, newItemNonce]);

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
      status: selectedItem?.status ?? "todo",
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
      {/* 手动添加 / 编辑 */}
      <div className="flex flex-shrink-0 items-center justify-between px-3 pb-1 pt-3">
        <h2 className="text-[13px] font-bold text-ink">{editing ? "编辑排期" : "手动添加"}</h2>
        {editing && <span className="max-w-[60%] truncate text-[10px] text-ink-muted">正在修改：{selectedItem?.title}</span>}
      </div>
      <div className="mx-3 flex flex-shrink-0 flex-col gap-2.5 pb-1">
        {noProjects ? (
          <div className="rounded-card bg-danger/10 px-3 py-3 text-sm text-danger">
            还没有工作项目，请先新增项目再添加排期。
          </div>
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
                <label className="mb-1 block text-xs font-medium text-ink-muted">所属项目</label>
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
            <p className="pb-1 text-[11px] leading-relaxed text-ink-muted/70">
              点选月/周/今日里的任一条即可修改；保存后会写入数据库并在三个视图同步显示。
            </p>
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
    </aside>
  );
}
