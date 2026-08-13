"use client";

import { useCallback, useEffect, useState } from "react";
import type { NoteBacklink } from "@/types";
import { formatNoteTime } from "@/lib/format-time";

interface BacklinksPanelProps {
  noteId: string;
  onOpenNote?: (noteId: string) => void;
}

/**
 * 反向链接面板：正文下方展示「被引用 N 次」，可展开跳转来源便签。
 * 自拉 /api/notes/:id/backlinks；失败或数量为 0 时返回 null（不占版面）。
 */
export default function BacklinksPanel({ noteId, onOpenNote }: BacklinksPanelProps) {
  const [backlinks, setBacklinks] = useState<NoteBacklink[]>([]);
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setOpen(false);
    setFailed(false);
    if (!noteId) return;
    fetch(`/api/notes/${noteId}/backlinks`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        setBacklinks(d?.backlinks ?? []);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [noteId]);

  const handleOpen = useCallback(
    (id: string) => {
      if (onOpenNote) void onOpenNote(id);
    },
    [onOpenNote]
  );

  if (failed || backlinks.length === 0) return null;

  return (
    <div className="border-t border-border-soft pt-2 pb-1">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-xs text-ink-muted hover:text-ink-secondary transition-colors"
        aria-expanded={open}
      >
        <svg
          className={`w-3 h-3 transition-transform ${open ? "rotate-90" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        被引用 {backlinks.length} 次
      </button>
      {open && (
        <ul className="mt-2 space-y-1.5">
          {backlinks.map((b) => (
            <li key={b.id}>
              <button
                onClick={() => handleOpen(b.id)}
                className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-surface-hover transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <span className="truncate text-[13px] text-ink-secondary group-hover:text-ink">
                    {b.title || "无标题便签"}
                  </span>
                  {b.isArchived && (
                    <span className="shrink-0 rounded px-1 py-px text-[10px] leading-none bg-toolbar-bg text-ink-muted">
                      已归档
                    </span>
                  )}
                </div>
                {b.summary && (
                  <div className="truncate text-xs text-ink-muted mt-0.5">{b.summary}</div>
                )}
                <div className="text-[11px] text-ink-muted/60 mt-0.5">
                  {formatNoteTime(b.updatedAt)}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
