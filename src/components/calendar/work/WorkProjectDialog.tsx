"use client";

import { useEffect, useState } from "react";
import type { WorkProject, WorkProjectColor, WorkProjectInput } from "@/types";
import { wpClass } from "./color";

interface Props {
  open: boolean;
  /** null = 新建；否则编辑。 */
  project: WorkProject | null;
  /** 新建时的默认项目色（自动分配）。 */
  defaultColor?: WorkProjectColor;
  onClose: () => void;
  onSave: (input: WorkProjectInput) => Promise<void>;
}

const COLOR_OPTIONS: { key: WorkProjectColor; label: string }[] = [
  { key: "blue", label: "蓝" },
  { key: "cyan", label: "青" },
  { key: "green", label: "绿" },
  { key: "lime", label: "黄绿" },
  { key: "amber", label: "琥珀" },
  { key: "orange", label: "橙" },
  { key: "red", label: "红" },
  { key: "pink", label: "粉" },
  { key: "purple", label: "紫" },
  { key: "gray", label: "灰" },
];

const inputCls =
  "w-full px-2.5 py-1.5 text-sm text-ink bg-panel-bg border border-border-light rounded-input outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15 transition-all";

export default function WorkProjectDialog({ open, project, defaultColor = "blue", onClose, onSave }: Props) {
  const [name, setName] = useState("");
  const [colorKey, setColorKey] = useState<WorkProjectColor>("blue");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(project?.name ?? "");
    setColorKey(project?.colorKey ?? defaultColor);
    setStartDate(project?.startDate ?? "");
    setEndDate(project?.endDate ?? "");
    setDescription(project?.description ?? "");
    setError(null);
    setSaving(false);
  }, [open, project, defaultColor]);

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
    const n = name.trim();
    if (!n) {
      setError("请输入项目名称");
      return;
    }
    if (startDate && endDate && startDate > endDate) {
      setError("开始日期不能晚于结束日期");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        name: n,
        colorKey,
        startDate: startDate || null,
        endDate: endDate || null,
        description,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose} role="presentation">
      <div
        className="w-full max-w-[400px] max-h-[90vh] overflow-y-auto rounded-modal bg-toolbar-bg border border-border-light shadow-2xl p-5"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={project ? "编辑项目" : "新增项目"}
      >
        <h3 className="text-base font-bold text-ink">{project ? "编辑项目" : "新增项目"}</h3>

        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1">项目名称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：A 项目 / V1 迭代"
              autoFocus
              maxLength={80}
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1.5">项目颜色</label>
            <div className="flex items-center gap-2.5">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  title={c.label}
                  onClick={() => setColorKey(c.key)}
                  className={`h-7 w-7 rounded-full wp-dot ${wpClass(c.key)} transition-all ${
                    colorKey === c.key
                      ? "ring-2 ring-offset-2 ring-offset-toolbar-bg ring-[var(--wp-base)] scale-110"
                      : "opacity-70 hover:opacity-100"
                  }`}
                  aria-label={c.label}
                />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1">开始日期</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1">预计结束</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} />
            </div>
          </div>

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

        <div className="mt-5 flex justify-end gap-2">
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
  );
}
