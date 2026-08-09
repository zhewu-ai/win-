"use client";

import { useEffect, useState } from "react";
import type { CalendarEvent, CalendarEventInput, CalendarEventStatus } from "@/types";
import EventNotePicker from "./EventNotePicker";

interface Props {
  open: boolean;
  /** 编辑模式下的原事件；null 表示新建。 */
  event: CalendarEvent | null;
  /** 新建时的默认日期（YYYY-MM-DD）。 */
  defaultDate: string;
  onClose: () => void;
  onSave: (input: CalendarEventInput) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "todo", label: "待完成" },
  { value: "done", label: "已完成" },
  { value: "postponed", label: "已延期" },
];

export default function EventEditorDialog({
  open,
  event,
  defaultDate,
  onClose,
  onSave,
  onDelete,
}: Props) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [allDay, setAllDay] = useState(true);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [status, setStatus] = useState<CalendarEventStatus>("todo");
  const [noteId, setNoteId] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (event) {
      setTitle(event.title);
      setDate(event.date);
      setAllDay(event.allDay);
      setStartTime(event.startTime ?? "");
      setEndTime(event.endTime ?? "");
      setStatus(event.status);
      setNoteId(event.noteId);
      setDescription(event.description || "");
    } else {
      setTitle("");
      setDate(defaultDate);
      setAllDay(true);
      setStartTime("");
      setEndTime("");
      setStatus("todo");
      setNoteId(null);
      setDescription("");
    }
    setError(null);
    setSaving(false);
    setDeleting(false);
  }, [open, event, defaultDate]);

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
      setError("请输入事件标题");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        title: t,
        description,
        date,
        allDay,
        startTime: allDay ? null : startTime || null,
        endTime: allDay ? null : endTime || null,
        status,
        noteId,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!event || !onDelete) return;
    if (!window.confirm(`删除事件「${event.title}」？此操作不会删除关联便签。`)) return;
    setDeleting(true);
    setError(null);
    try {
      await onDelete(event.id);
      onClose();
    } catch {
      setError("删除失败");
      setDeleting(false);
    }
  };

  const inputCls =
    "w-full px-2.5 py-1.5 text-sm text-ink bg-panel-bg border border-border-light rounded-input outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15 transition-all";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-[400px] max-h-[90vh] overflow-y-auto rounded-modal bg-toolbar-bg border border-border-light shadow-2xl p-5"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={event ? "编辑事件" : "新建事件"}
      >
        <h3 className="text-base font-bold text-ink">
          {event ? "编辑事件" : "新建事件"}
        </h3>

        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1">标题</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="事件标题"
              autoFocus
              maxLength={120}
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1">日期</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputCls}
            />
          </div>

          <label className="flex items-center gap-2 select-none">
            <input
              type="checkbox"
              checked={allDay}
              onChange={(e) => setAllDay(e.target.checked)}
              className="accent-primary"
            />
            <span className="text-sm text-ink">全天事件</span>
          </label>

          <div className={`grid grid-cols-2 gap-3 ${allDay ? "opacity-50 pointer-events-none" : ""}`}>
            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1">开始时间</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1">结束时间</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1">状态</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as CalendarEventStatus)}
              className={inputCls}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <EventNotePicker value={noteId} onChange={setNoteId} noteTitle={event?.note?.title ?? null} />

          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1">备注</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="可选备注"
              maxLength={1000}
              rows={2}
              className={`${inputCls} resize-none`}
            />
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-danger">{error}</p>}

        <div className="mt-5 flex justify-between items-center gap-2">
          <div>
            {event && onDelete && (
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
              disabled={saving}
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
