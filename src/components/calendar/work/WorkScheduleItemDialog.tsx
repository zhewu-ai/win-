"use client";

import { useEffect, useState } from "react";
import type { WorkProject, WorkScheduleItem, WorkScheduleItemInput } from "@/types";
import EventNotePicker from "../EventNotePicker";

interface Props {
  open: boolean;
  /** null = 新建；否则编辑。 */
  item: WorkScheduleItem | null;
  /** 新建时的默认日期（YYYY-MM-DD）。 */
  defaultDate: string;
  /** 可选的所属项目（active 项目）。 */
  projects: WorkProject[];
  /** 新建时默认选中的项目 id。 */
  defaultProjectId?: string | null;
  onClose: () => void;
  onSave: (input: WorkScheduleItemInput) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "todo", label: "待完成" },
  { value: "done", label: "已完成" },
  { value: "postponed", label: "已延期" },
];

const inputCls =
  "w-full px-2.5 py-1.5 text-sm text-ink bg-panel-bg border border-border-light rounded-input outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15 transition-all";

export default function WorkScheduleItemDialog({
  open,
  item,
  defaultDate,
  projects,
  defaultProjectId,
  onClose,
  onSave,
  onDelete,
}: Props) {
  const [projectId, setProjectId] = useState("");
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"range" | "node">("range");
  const [startDate, setStartDate] = useState(defaultDate);
  const [endDate, setEndDate] = useState(defaultDate);
  const [status, setStatus] = useState<string>("todo");
  const [noteId, setNoteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (item) {
      setProjectId(item.projectId);
      setTitle(item.title);
      setType(item.type);
      setStartDate(item.startDate);
      setEndDate(item.endDate);
      setStatus(item.status);
      setNoteId(item.noteId);
    } else {
      const pid = defaultProjectId && projects.some((p) => p.id === defaultProjectId) ? defaultProjectId : projects[0]?.id ?? "";
      setProjectId(pid);
      setTitle("");
      setType("range");
      setStartDate(defaultDate);
      setEndDate(defaultDate);
      setStatus("todo");
      setNoteId(null);
    }
    setError(null);
    setSaving(false);
    setDeleting(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item, defaultDate, defaultProjectId]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const handleSave = async () => {
    const t = title.trim();
    if (!t) {
      setError("请输入标题");
      return;
    }
    if (!projectId) {
      setError("请选择所属项目");
      return;
    }
    if (!startDate) {
      setError("请选择开始日期");
      return;
    }
    if (type === "range" && endDate && startDate > endDate) {
      setError("结束日期不能早于开始日期");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        projectId,
        title: t,
        type,
        startDate,
        endDate: type === "node" ? startDate : endDate || startDate,
        status: status as WorkScheduleItemInput["status"],
        noteId,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!item || !onDelete) return;
    if (!window.confirm(`删除排期「${item.title}」？此操作不会删除关联便签。`)) return;
    setDeleting(true);
    setError(null);
    try {
      await onDelete(item.id);
      onClose();
    } catch {
      setError("删除失败");
      setDeleting(false);
    }
  };

  const noProjects = projects.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose} role="presentation">
      <div
        className="w-full max-w-[420px] max-h-[90vh] overflow-y-auto rounded-modal bg-toolbar-bg border border-border-light shadow-2xl p-5"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={item ? "编辑排期" : "新增排期"}
      >
        <h3 className="text-base font-bold text-ink">{item ? "编辑排期" : "新增排期"}</h3>

        {noProjects ? (
          <p className="mt-4 px-3 py-4 rounded-card bg-danger/10 text-sm text-danger">
            还没有工作项目，请先创建项目再添加排期。
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1">所属项目</label>
              <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={inputCls}>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1">标题</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例如：A 修改 / V1 提交&反馈"
                autoFocus
                maxLength={120}
                className={inputCls}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1.5">类型</label>
              <div className="flex gap-2">
                {(
                  [
                    ["range", "连续阶段"],
                    ["node", "单日节点"],
                  ] as const
                ).map(([v, label]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => {
                      setType(v);
                      if (v === "node") setEndDate(startDate);
                    }}
                    className={`px-3 py-1.5 rounded-btn text-sm transition-colors ${
                      type === v ? "bg-primary text-white font-semibold" : "text-ink-secondary hover:bg-surface-hover"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-ink-muted mb-1">开始日期</label>
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
                <label className="block text-xs font-medium text-ink-muted mb-1">结束日期</label>
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
              <label className="block text-xs font-medium text-ink-muted mb-1">状态</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <EventNotePicker value={noteId} onChange={setNoteId} noteTitle={item?.note?.title ?? null} />
          </div>
        )}

        {error && <p className="mt-3 text-sm text-danger">{error}</p>}

        <div className="mt-5 flex justify-between items-center gap-2">
          <div>
            {item && onDelete && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-3 py-1.5 rounded-btn text-sm font-semibold text-danger hover:bg-danger/10 transition-colors disabled:opacity-50"
              >
                {deleting ? "删除中..." : "删除"}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-btn text-sm font-semibold text-ink-secondary hover:text-ink hover:bg-surface-hover transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={saving || noProjects}
              className="px-3.5 py-1.5 rounded-btn text-sm font-semibold text-white bg-primary hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saving ? "保存中..." : "保存"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
