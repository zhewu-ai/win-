"use client";

import { useEffect, useMemo, useState } from "react";
import type { Note } from "@/types";

interface Props {
  open: boolean;
  /** 可链接的未归档便签列表（来自当前加载列表，客户端按标题过滤） */
  notes: Note[];
  onSelect: (note: Note) => void;
  onClose: () => void;
}

function excerpt(note: Note): string {
  const text =
    note.mode === "checklist"
      ? note.checklistItems.map((i) => i.text).join(" ")
      : note.content;
  const t = (text || "").replace(/\s+/g, " ").trim();
  return t.length > 60 ? t.slice(0, 60) + "…" : t;
}

export default function InsertNoteLinkDialog({ open, notes, onSelect, onClose }: Props) {
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!open) return;
    setQ("");
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    if (!kw) return notes;
    return notes.filter(
      (n) =>
        n.title.toLowerCase().includes(kw) ||
        (n.mode !== "checklist" && n.content.toLowerCase().includes(kw))
    );
  }, [notes, q]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md flex flex-col bg-toolbar-bg border border-border-light rounded-modal shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="插入便签链接"
      >
        <div className="px-4 pt-4 pb-3">
          <h3 className="text-base font-bold text-ink">插入便签链接</h3>
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索便签…"
            className="mt-3 w-full px-3 py-2 rounded-btn bg-surface text-sm text-ink border border-border-light outline-none focus:border-primary/50 placeholder:text-ink-muted/50"
          />
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin max-h-[46vh] border-t border-border-light/60">
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-sm text-ink-muted/60 text-center">
              没有可链接的便签
            </div>
          ) : (
            filtered.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => onSelect(n)}
                className="w-full text-left px-4 py-2.5 hover:bg-surface-hover transition-colors border-b border-border-light/40 last:border-b-0"
              >
                <div className="text-sm text-ink font-medium truncate">
                  {n.title || "未命名便签"}
                </div>
                {excerpt(n) && (
                  <div className="mt-0.5 text-xs text-ink-muted/60 truncate">
                    {excerpt(n)}
                  </div>
                )}
              </button>
            ))
          )}
        </div>
        <div className="px-4 py-2.5 text-right border-t border-border-light/60">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-btn text-sm font-semibold text-ink-secondary hover:text-ink hover:bg-surface-hover transition-colors"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
