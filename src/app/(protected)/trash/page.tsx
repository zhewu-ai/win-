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

  // 多选模式
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedSet, setSelectedSet] = useState<Set<string>>(new Set());
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [bulkDeleteInputOpen, setBulkDeleteInputOpen] = useState(false);
  const [deleteInputValue, setDeleteInputValue] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);

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

  // 列表变化时剔除已消失的选中项
  useEffect(() => {
    setSelectedSet((prev) => {
      const ids = new Set(notes.map((n) => n.id));
      const next = new Set([...prev].filter((id) => ids.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [notes]);

  // 空列表退出多选
  useEffect(() => {
    if (notes.length === 0) {
      setSelectionMode(false);
      setSelectedSet(new Set());
      setBulkConfirmOpen(false);
      setBulkDeleteInputOpen(false);
      setDeleteInputValue("");
    }
  }, [notes.length]);

  const visibleIds = notes.map((n) => n.id);
  const allSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedSet.has(id));

  const toggleSelectAll = () => {
    setSelectedSet((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        visibleIds.forEach((id) => next.delete(id));
      } else {
        visibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const exitSelection = () => {
    setSelectionMode(false);
    setSelectedSet(new Set());
    setBulkConfirmOpen(false);
    setBulkDeleteInputOpen(false);
    setDeleteInputValue("");
  };

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

  const handleBulkRestore = async () => {
    const ids = Array.from(selectedSet);
    if (ids.length === 0) return;
    setBulkBusy(true);
    try {
      const res = await fetch("/api/notes/bulk-restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error();
      setNotes((prev) => prev.filter((n) => !ids.includes(n.id)));
      exitSelection();
    } catch {
      alert("批量恢复失败");
    } finally {
      setBulkBusy(false);
    }
  };

  const confirmBulkPermanentDelete = async () => {
    const ids = Array.from(selectedSet);
    if (ids.length === 0) return;
    setBulkBusy(true);
    try {
      const res = await fetch("/api/notes/bulk-permanent-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error();
      setNotes((prev) => prev.filter((n) => !ids.includes(n.id)));
      exitSelection();
    } catch {
      alert("批量永久删除失败");
    } finally {
      setBulkBusy(false);
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

      {/* Selection toolbar / three-dot entry */}
      {selectionMode ? (
        <div className="flex items-center gap-1.5 px-4 py-2 border-b border-border-light bg-toolbar-bg flex-shrink-0">
          <span className="text-xs font-medium text-ink-muted flex-shrink-0">
            已选 {selectedSet.size} 条
          </span>
          <button
            onClick={toggleSelectAll}
            className="text-xs font-medium text-ink-secondary hover:text-ink hover:bg-surface-hover rounded-btn px-1.5 py-1 transition-colors flex-shrink-0"
          >
            {allSelected ? "取消全选" : "全选"}
          </button>
          <div className="flex-1" />
          <button
            onClick={exitSelection}
            className="text-xs font-medium text-ink-muted hover:text-ink hover:bg-surface-hover rounded-btn px-1.5 py-1 transition-colors flex-shrink-0"
          >
            取消
          </button>
          <button
            onClick={() => void handleBulkRestore()}
            disabled={selectedSet.size === 0 || bulkBusy}
            className="text-xs font-medium text-primary hover:bg-primary/10 rounded-btn px-2 py-1 transition-colors flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
          >
            {bulkBusy ? "处理中..." : "恢复"}
          </button>
          <button
            onClick={() => setBulkConfirmOpen(true)}
            disabled={selectedSet.size === 0 || bulkBusy}
            className="text-xs font-medium text-danger hover:bg-danger/10 rounded-btn px-2 py-1 transition-colors flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
          >
            永久删除
          </button>
        </div>
      ) : (
        <div className="flex justify-end px-4 pt-2 flex-shrink-0">
          <button
            onClick={() => {
              setSelectionMode(true);
              setSelectedSet(new Set());
            }}
            title="选择便签"
            aria-label="选择便签"
            className="flex items-center justify-center w-icon-btn h-icon-btn text-ink-muted hover:text-ink hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:text-ink rounded-btn transition-colors"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="5" cy="12" r="1.7" />
              <circle cx="12" cy="12" r="1.7" />
              <circle cx="19" cy="12" r="1.7" />
            </svg>
          </button>
        </div>
      )}

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
              const checked = selectedSet.has(note.id);
              return (
                <div
                  key={note.id}
                  className={`rounded-card transition-colors ${
                    checked ? "bg-primary/10" : "hover:bg-surface-hover"
                  }`}
                >
                  {selectionMode ? (
                    <button
                      onClick={() => {
                        setSelectedSet((prev) => {
                          const next = new Set(prev);
                          if (next.has(note.id)) next.delete(note.id);
                          else next.add(note.id);
                          return next;
                        });
                      }}
                      className="w-full text-left"
                      aria-label="切换选择"
                    >
                      <div className="flex items-center gap-3 px-4 py-3">
                        <span
                          className={`flex-shrink-0 w-[18px] h-[18px] rounded-full border flex items-center justify-center transition-colors ${
                            checked
                              ? "bg-primary border-primary text-white"
                              : "border-border-strong"
                          }`}
                          aria-hidden="true"
                        >
                          {checked && (
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </span>
                        <span className={`card-color-dot ${accent}`} aria-hidden="true" />
                        <div className="flex-1 min-w-0">
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
                      </div>
                    </button>
                  ) : (
                    <div className="flex items-center gap-3 rounded-card px-4 py-3">
                      <span className={`card-color-dot ${accent}`} aria-hidden="true" />
                      <div className="flex-1 min-w-0">
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
                  )}
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

      <ConfirmDialog
        open={bulkConfirmOpen}
        title="永久删除"
        message={`确定永久删除选中的 ${selectedSet.size} 条便签？此操作不可恢复。`}
        confirmLabel="永久删除"
        onConfirm={() => {
          setBulkConfirmOpen(false);
          setBulkDeleteInputOpen(true);
          setDeleteInputValue("");
        }}
        onCancel={() => setBulkConfirmOpen(false)}
      />

      {bulkDeleteInputOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => {
            setBulkDeleteInputOpen(false);
            setDeleteInputValue("");
          }}
          role="presentation"
        >
          <div
            className="w-full max-w-[340px] rounded-modal bg-toolbar-bg border border-border-light shadow-2xl p-5"
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
          >
            <h3 className="text-base font-bold text-ink">确认永久删除</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
              请输入 <span className="font-mono font-semibold text-danger">DELETE</span>{" "}
              确认永久删除选中的 {selectedSet.size} 条便签。此操作不可恢复。
            </p>
            <input
              type="text"
              value={deleteInputValue}
              onChange={(e) => setDeleteInputValue(e.target.value)}
              autoFocus
              placeholder="DELETE"
              className="mt-3 w-full px-3 py-2 text-sm rounded-input bg-search-bg border border-border-light outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 placeholder:text-ink-muted/60"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => {
                  setBulkDeleteInputOpen(false);
                  setDeleteInputValue("");
                }}
                className="px-3.5 py-1.5 rounded-btn text-sm font-semibold text-ink-secondary hover:text-ink hover:bg-surface-hover transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => {
                  setBulkDeleteInputOpen(false);
                  setDeleteInputValue("");
                  void confirmBulkPermanentDelete();
                }}
                disabled={deleteInputValue !== "DELETE" || bulkBusy}
                className="px-3.5 py-1.5 rounded-btn text-sm font-semibold text-white bg-danger hover:bg-danger/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {bulkBusy ? "删除中..." : "永久删除"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
