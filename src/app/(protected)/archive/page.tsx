"use client";

import { useRouter } from "next/navigation";
import { useState, useCallback, useEffect, useRef } from "react";
import type { Note } from "@/types";
import ImagePreview from "@/components/ImagePreview";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useLayoutMode } from "@/hooks/useLayoutMode";
import type { Attachment } from "@/types";
import { formatNoteTime } from "@/lib/format-time";

const ACCENT: Record<string, string> = {
  yellow: "bg-accent-yellow",
  blue: "bg-accent-blue",
  green: "bg-accent-green",
  pink: "bg-accent-pink",
  gray: "bg-accent-gray",
};

export default function ArchivePage() {
  const router = useRouter();
  // 整体布局模式：<720 单栏（列表↔详情切换）；≥720 双栏（舒展/紧凑）
  const mode = useLayoutMode();
  const single = mode === "single";
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [previewAtt, setPreviewAtt] = useState<Attachment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const fetchingRef = useRef(false);

  // 多选模式
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedSet, setSelectedSet] = useState<Set<string>>(new Set());
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  const selectedNote = notes.find((n) => n.id === selectedNoteId) || null;

  const fetchNotes = useCallback(async (q?: string) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    try {
      const params = new URLSearchParams({ archived: "true" });
      if (q) params.set("q", q);
      const res = await fetch(`/api/notes?${params}`);
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
  };

  const handleUnarchive = async (id: string) => {
    try {
      const res = await fetch(`/api/notes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isArchived: false }),
      });
      if (!res.ok) throw new Error();
      setNotes((prev) => prev.filter((n) => n.id !== id));
      if (selectedNoteId === id) setSelectedNoteId(null);
    } catch {
      alert("取消归档失败");
    }
  };

  const handleBulkUnarchive = async () => {
    const ids = Array.from(selectedSet);
    if (ids.length === 0) return;
    setBulkBusy(true);
    try {
      const res = await fetch("/api/notes/bulk-unarchive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error();
      setNotes((prev) => prev.filter((n) => !ids.includes(n.id)));
      if (selectedNoteId && ids.includes(selectedNoteId)) setSelectedNoteId(null);
      exitSelection();
    } catch {
      alert("批量取消归档失败");
    } finally {
      setBulkBusy(false);
    }
  };

  const handleDelete = (id: string) => {
    setDeleteTarget(id);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const id = deleteTarget;
    setDeleteTarget(null);
    try {
      const res = await fetch(`/api/notes/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setNotes((prev) => prev.filter((n) => n.id !== id));
      if (selectedNoteId === id) setSelectedNoteId(null);
    } catch {
      alert("删除失败");
    }
  };

  const confirmBulkDelete = async () => {
    const ids = Array.from(selectedSet);
    if (ids.length === 0) return;
    setBulkBusy(true);
    try {
      const res = await fetch("/api/notes/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error();
      setNotes((prev) => prev.filter((n) => !ids.includes(n.id)));
      if (selectedNoteId && ids.includes(selectedNoteId)) setSelectedNoteId(null);
      setBulkConfirmOpen(false);
      exitSelection();
    } catch {
      alert("批量删除失败");
    } finally {
      setBulkBusy(false);
    }
  };

  const handleSearch = (q: string) => {
    setSearchQuery(q);
    fetchNotes(q || undefined);
  };

  const pinned = notes.filter((n) => n.isPinned);
  const regular = notes.filter((n) => !n.isPinned);

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
        <span className="text-toolbar font-semibold text-ink">归档</span>
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
            placeholder="搜索归档..."
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
      <div className="flex-1 flex overflow-hidden">
        {/* List */}
        <div className={`${single && selectedNote ? "hidden" : "flex"} ${single ? "w-full" : "w-80"} flex-col border-r border-border-light bg-toolbar-bg`}>
          {selectionMode ? (
            <div className="flex items-center gap-1.5 px-3 pt-2 flex-shrink-0">
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
                onClick={() => void handleBulkUnarchive()}
                disabled={selectedSet.size === 0 || bulkBusy}
                className="text-xs font-medium text-primary hover:bg-primary/10 rounded-btn px-2 py-1 transition-colors flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              >
                {bulkBusy ? "处理中..." : "取消归档"}
              </button>
              <button
                onClick={() => setBulkConfirmOpen(true)}
                disabled={selectedSet.size === 0 || bulkBusy}
                className="text-xs font-medium text-danger hover:bg-danger/10 rounded-btn px-2 py-1 transition-colors flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              >
                删除
              </button>
            </div>
          ) : (
            <div className="flex justify-end px-3 pt-1 flex-shrink-0">
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

          <div className="flex-1 overflow-y-auto scrollbar-thin [scrollbar-gutter:stable]">
            {loading ? (
              <div className="p-3 space-y-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-16 rounded-card bg-surface-hover animate-pulse"
                  />
                ))}
              </div>
            ) : notes.length === 0 ? (
              <div className="flex-1 flex items-center justify-center p-8 text-center">
                <p className="text-ink-muted text-list-summary">
                  {searchQuery ? "未找到匹配的归档" : "暂无归档便签"}
                </p>
              </div>
            ) : (
              <div className="px-2 py-1.5 space-y-0.5">
                {pinned.map((note) => (
                  <ArchiveNoteItem
                    key={note.id}
                    note={note}
                    isSelected={selectedNoteId === note.id}
                    selectionMode={selectionMode}
                    isChecked={selectedSet.has(note.id)}
                    onSelect={setSelectedNoteId}
                    onToggle={(id) => {
                      setSelectedSet((prev) => {
                        const next = new Set(prev);
                        if (next.has(id)) next.delete(id);
                        else next.add(id);
                        return next;
                      });
                    }}
                    onUnarchive={handleUnarchive}
                    onDelete={handleDelete}
                  />
                ))}
                {regular.map((note) => (
                  <ArchiveNoteItem
                    key={note.id}
                    note={note}
                    isSelected={selectedNoteId === note.id}
                    selectionMode={selectionMode}
                    isChecked={selectedSet.has(note.id)}
                    onSelect={setSelectedNoteId}
                    onToggle={(id) => {
                      setSelectedSet((prev) => {
                        const next = new Set(prev);
                        if (next.has(id)) next.delete(id);
                        else next.add(id);
                        return next;
                      });
                    }}
                    onUnarchive={handleUnarchive}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Detail panel - desktop (dual mode) */}
        <div className={`${single ? "hidden" : "flex"} flex-1 flex-col bg-toolbar-bg`}>
          {selectedNote ? (
            <div className="flex-1 p-6 overflow-y-auto scrollbar-thin [scrollbar-gutter:stable]">
              <div className="max-w-paper mx-auto">
                <div className="flex items-start gap-2 mb-4">
                  <div
                    className={`w-3 h-3 rounded-full mt-2 flex-shrink-0 ${ACCENT[selectedNote.color] || "bg-ink-muted/30"}`}
                  />
                  <h2 className="text-edit-title">
                    {getAutoTitle(selectedNote)}
                  </h2>
                </div>
                {selectedNote.mode === "checklist" && selectedNote.checklistItems?.length > 0 ? (
                  <div className="ml-5 space-y-1.5">
                    {selectedNote.checklistItems.map((item) => (
                      <div key={item.id} className="flex items-start gap-2.5">
                        <span className={`flex-shrink-0 mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          item.checked
                            ? "bg-primary border-primary"
                            : "border-ink-muted/30"
                        }`}>
                          {item.checked && (
                            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </span>
                        <span className={`text-edit-body ${item.checked ? "text-ink-muted/60 line-through" : "text-ink"}`}>
                          {item.text}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-edit-body text-ink ml-5 whitespace-pre-wrap">
                    {selectedNote.content || "（无内容）"}
                  </p>
                )}

                {/* Image attachments */}
                {selectedNote.attachments && selectedNote.attachments.length > 0 && (
                  <div className="ml-5 mt-6 grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {selectedNote.attachments.map((att) => (
                      <div key={att.id} className="aspect-square rounded-thumb overflow-hidden bg-surface-hover cursor-pointer" onClick={() => setPreviewAtt(att)}>
                        <img src={att.url} alt={att.filename} className="w-full h-full object-cover hover:opacity-90 transition-opacity" />
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-8 ml-5 flex gap-2">
                  <button
                    onClick={() => handleUnarchive(selectedNote.id)}
                    className="px-3.5 py-1.5 text-toolbar text-white bg-primary rounded-btn hover:brightness-110 active:brightness-95 transition-all"
                  >
                    取消归档
                  </button>
                  <button
                    onClick={() => handleDelete(selectedNote.id)}
                    className="px-3.5 py-1.5 text-toolbar text-white bg-danger rounded-btn hover:brightness-110 active:brightness-95 transition-all"
                  >
                    删除
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-ink-muted text-sm bg-page-bg">
              <div className="text-center">
                <svg className="w-8 h-8 text-ink-muted/30 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
                <p>选择一条便签查看详情</p>
              </div>
            </div>
          )}
        </div>

        {/* Mobile detail - single-column mode */}
        {selectedNote && (
          <div className={`${single ? "flex" : "hidden"} flex-1 flex-col bg-toolbar-bg p-4 overflow-y-auto [scrollbar-gutter:stable]`}>
            <div className="flex items-start gap-2 mb-4">
              <div
                className={`w-3 h-3 rounded-full mt-2 flex-shrink-0 ${ACCENT[selectedNote.color] || "bg-ink-muted/30"}`}
              />
              <h2 className="text-edit-title">
                {getAutoTitle(selectedNote)}
              </h2>
            </div>
            {selectedNote.mode === "checklist" && selectedNote.checklistItems?.length > 0 ? (
              <div className="flex-1 ml-5 space-y-1.5 overflow-y-auto [scrollbar-gutter:stable]">
                {selectedNote.checklistItems.map((item) =>
                  item.kind === "heading" ? (
                    <div key={item.id} className="flex items-start gap-2.5">
                      <span className="flex-shrink-0 mt-0.5 w-4 h-4 rounded-full border-2 border-ink-muted/15" />
                      <span className="text-edit-body font-semibold text-ink-muted/70">
                        {item.text}
                      </span>
                    </div>
                  ) : (
                  <div key={item.id} className="flex items-start gap-2.5">
                    <span className={`flex-shrink-0 mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      item.checked
                        ? "bg-primary border-primary"
                        : "border-ink-muted/30"
                    }`}>
                      {item.checked && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                    <span className={`text-edit-body ${item.checked ? "text-ink-muted/60 line-through" : "text-ink"}`}>
                      {item.text}
                    </span>
                  </div>
                  )
                )}
              </div>
            ) : (
              <p className="text-edit-body text-ink whitespace-pre-wrap flex-1 ml-5">
                {selectedNote.content || "（无内容）"}
              </p>
            )}

            {/* Image attachments */}
            {selectedNote.attachments && selectedNote.attachments.length > 0 && (
              <div className="ml-5 mt-4 grid grid-cols-3 gap-2">
                {selectedNote.attachments.map((att) => (
                  <div key={att.id} className="aspect-square rounded-thumb overflow-hidden bg-surface-hover cursor-pointer" onClick={() => setPreviewAtt(att)}>
                    <img src={att.url} alt={att.filename} className="w-full h-full object-cover hover:opacity-90 transition-opacity" />
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 ml-5 flex gap-2">
              <button
                onClick={() => handleUnarchive(selectedNote.id)}
                className="px-3.5 py-1.5 text-toolbar text-white bg-primary rounded-btn hover:brightness-110 active:brightness-95 transition-all"
              >
                取消归档
              </button>
              <button
                onClick={() => handleDelete(selectedNote.id)}
                className="px-3.5 py-1.5 text-toolbar text-white bg-danger rounded-btn hover:brightness-110 active:brightness-95 transition-all"
              >
                删除
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Image preview */}
      {previewAtt && (
        <ImagePreview
          attachment={previewAtt}
          onClose={() => setPreviewAtt(null)}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="删除便签"
        message="确定删除此便签？删除后可在回收站恢复。"
        confirmLabel="删除"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={bulkConfirmOpen}
        title="批量删除"
        message={`确定将选中的 ${selectedSet.size} 条归档便签移入回收站？`}
        confirmLabel={bulkBusy ? "删除中..." : "删除"}
        onConfirm={() => void confirmBulkDelete()}
        onCancel={() => setBulkConfirmOpen(false)}
      />
    </div>
  );
}

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

function getTodoProgress(note: Note): { done: number; total: number } | null {
  if (note.mode !== "checklist" || !note.checklistItems?.length) return null;
  const nonEmpty = note.checklistItems.filter((i) => i.text.trim().length > 0);
  if (nonEmpty.length === 0) return null;
  return {
    done: nonEmpty.filter((i) => i.checked).length,
    total: nonEmpty.length,
  };
}

function ArchiveNoteItem({
  note,
  isSelected,
  selectionMode,
  isChecked,
  onSelect,
  onToggle,
  onUnarchive,
  onDelete,
}: {
  note: Note;
  isSelected: boolean;
  selectionMode: boolean;
  isChecked: boolean;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onUnarchive: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const accent = ACCENT[note.color] || "bg-accent-gray";
  const selectedCls = ACCENT[note.color]
    ? `card-selected card-selected-${note.color}`
    : "card-selected card-selected-gray";
  const dotCls = isSelected
    ? "card-color-dot card-color-dot-selected"
    : "card-color-dot";
  const progress = getTodoProgress(note);
  const handleClick = () => (selectionMode ? onToggle(note.id) : onSelect(note.id));

  return (
    <div
      className={`relative rounded-card transition-colors ${
        isSelected ? selectedCls : "card-surface"
      }`}
    >
      <button
        onClick={handleClick}
        className="w-full text-left"
        aria-label={selectionMode ? "切换选择" : "查看详情"}
      >
        <div className={`px-4 py-3 ${selectionMode ? "flex items-start gap-2" : ""}`}>
          {selectionMode && (
            <span
              className={`mt-0.5 flex-shrink-0 w-[18px] h-[18px] rounded-full border flex items-center justify-center transition-colors ${
                isChecked
                  ? "bg-primary border-primary text-white"
                  : "border-border-strong"
              }`}
              aria-hidden="true"
            >
              {isChecked && (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </span>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2.5">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  {note.isPinned && (
                    <svg
                      className="w-3 h-3 text-ink-muted flex-shrink-0"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                    </svg>
                  )}
                  <span className={`text-list-title truncate ${isSelected ? "text-white" : "text-ink"}`}>
                    {getAutoTitle(note)}
                  </span>
                </div>
                {progress && (
                  <p className={`text-list-meta mt-0.5 ${isSelected ? "text-white/[0.75]" : "text-ink-muted"}`}>
                    待办 {progress.done}/{progress.total}
                  </p>
                )}
              </div>
              <span className={`${dotCls} ${accent} mt-0.5`} aria-hidden="true" />
            </div>
          </div>
        </div>
      </button>
      {!selectionMode && (
        <div className="flex items-center justify-between gap-2 px-4 pb-2.5">
          <div className="flex gap-2">
            <button
              onClick={() => onUnarchive(note.id)}
              className={`text-list-meta transition-colors ${isSelected ? "text-white/[0.85] hover:text-white" : "text-primary hover:text-primary/80"}`}
            >
              取消归档
            </button>
            <button
              onClick={() => onDelete(note.id)}
              className={`text-list-meta transition-colors ${isSelected ? "text-white/[0.85] hover:text-white" : "text-danger hover:text-danger/80"}`}
            >
              删除
            </button>
          </div>
          <span
            className={`text-list-meta transition-colors ${isSelected ? "text-white/[0.7]" : "text-ink-muted"}`}
          >
            {formatNoteTime(note.updatedAt)}
          </span>
        </div>
      )}
    </div>
  );
}
