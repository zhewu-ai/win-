"use client";

import { useRouter } from "next/navigation";
import { useState, useCallback, useEffect, useRef } from "react";
import type { Note } from "@/types";
import ConfirmDialog from "@/components/ConfirmDialog";
import { formatDeletedDate, formatTrashRetention } from "@/lib/format-time";

const ACCENT: Record<string, string> = {
  yellow: "bg-accent-yellow",
  blue: "bg-accent-blue",
  green: "bg-accent-green",
  pink: "bg-accent-pink",
  gray: "bg-accent-gray",
};

function getAutoTitle(note: Note): string {
  if (note.title) return note.title;
  if (note.mode === "text") {
    const firstLine = note.content.split("\n")[0]?.trim();
    if (firstLine) return firstLine;
  }
  if (note.mode === "checklist" && note.checklistItems?.length > 0) {
    const firstItem = note.checklistItems.find((i) => i.text.trim().length > 0);
    if (firstItem) return firstItem.text;
  }
  return "无标题便签";
}

export default function TrashPage() {
  const router = useRouter();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const fetchingRef = useRef(false);

  const fetchNotes = useCallback(async (q?: string) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      const res = await fetch(`/api/notes/trash?${params}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setNotes(data.notes);
    } catch {
      setNotes([]);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const handleRestore = async (id: string) => {
    try {
      const res = await fetch(`/api/notes/${id}/restore`, { method: "POST" });
      if (!res.ok) throw new Error();
      setNotes((prev) => prev.filter((n) => n.id !== id));
    } catch {
      alert("恢复失败");
    }
  };

  const handlePermanentDelete = (id: string) => {
    setDeleteTarget(id);
  };

  const confirmPermanentDelete = async () => {
    if (!deleteTarget) return;
    const id = deleteTarget;
    setDeleteTarget(null);
    try {
      const res = await fetch(`/api/notes/${id}/permanent`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      setNotes((prev) => prev.filter((n) => n.id !== id));
    } catch {
      alert("永久删除失败");
    }
  };

  const handleSearch = (q: string) => {
    setSearchQuery(q);
    fetchNotes(q || undefined);
  };

  return (
    <div className="h-screen flex flex-col bg-page-bg">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border-light bg-toolbar-bg z-10 min-h-[52px]">
        <button
          onClick={() => router.push("/")}
          className="flex items-center justify-center w-icon-btn h-icon-btn text-ink-muted hover:bg-surface-hover rounded-btn transition-colors"
          title="返回主页"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-toolbar font-semibold text-ink">回收站</span>
        <div className="flex-1" />
        <div className="relative flex-1 max-w-xs">
          <svg
            className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted/60 pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="搜索回收站..."
            className="w-full pl-9 pr-8 py-1.5 text-sm bg-search-bg rounded-input border border-transparent outline-none focus:bg-toolbar-bg focus:border-border-light focus:ring-1 focus:ring-ink-muted/30 transition-all placeholder:text-ink-muted/60"
          />
          {searchQuery && (
            <button
              onClick={() => handleSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-ink-muted hover:text-ink-secondary rounded transition-colors"
              title="清空搜索"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin [scrollbar-gutter:stable]">
        {loading ? (
          <div className="p-4 space-y-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-20 rounded-card bg-surface-hover animate-pulse"
              />
            ))}
          </div>
        ) : notes.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-16 text-center">
            <div>
              <svg
                className="w-10 h-10 text-ink-muted/40 mx-auto mb-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <p className="text-ink-muted text-list-summary">
                {searchQuery ? "未找到匹配的已删除便签" : "回收站为空"}
              </p>
            </div>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto p-4 space-y-1">
            {notes.map((note) => {
              const accent = ACCENT[note.color] || "bg-accent-gray";
              const autoTitle = getAutoTitle(note);
              return (
                <div
                  key={note.id}
                  className="relative flex items-center gap-3 rounded-card px-4 py-3 hover:bg-surface-hover transition-colors"
                >
                  <span
                    className={`absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-full ${accent}`}
                  />
                  <div className="flex-1 min-w-0 pl-1">
                    <p className="text-list-title text-ink truncate">
                      {autoTitle}
                    </p>
                    <p className="text-list-meta text-ink-muted mt-0.5">
                      删除于 {formatDeletedDate(note.deletedAt || "")}
                      {note.deletedAt && (
                        <span className="ml-1.5">
                          · {formatTrashRetention(note.deletedAt)}
                        </span>
                      )}
                      {note.attachments && note.attachments.length > 0 && (
                        <span className="ml-2">
                          {note.attachments.length} 图
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => handleRestore(note.id)}
                      className="px-3 py-1.5 text-list-meta text-primary hover:bg-primary/10 rounded-btn transition-colors"
                    >
                      恢复
                    </button>
                    <button
                      onClick={() => handlePermanentDelete(note.id)}
                      className="px-3 py-1.5 text-list-meta text-danger hover:bg-danger/10 rounded-btn transition-colors"
                    >
                      永久删除
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="永久删除"
        message="永久删除后无法恢复，确定删除此便签？"
        confirmLabel="永久删除"
        onConfirm={confirmPermanentDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
