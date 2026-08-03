"use client";

import { useRouter } from "next/navigation";
import { useState, useCallback, useEffect, useRef } from "react";
import type { Note } from "@/types";
import ImagePreview from "@/components/ImagePreview";
import type { Attachment } from "@/types";

const ACCENT: Record<string, string> = {
  yellow: "bg-accent-yellow",
  blue: "bg-accent-blue",
  green: "bg-accent-green",
  pink: "bg-accent-pink",
  gray: "bg-accent-gray",
};

const SELECTED: Record<string, string> = {
  yellow: "bg-sel-yellow",
  blue: "bg-sel-blue",
  green: "bg-sel-green",
  pink: "bg-sel-pink",
  gray: "bg-sel-gray",
};

export default function ArchivePage() {
  const router = useRouter();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [previewAtt, setPreviewAtt] = useState<Attachment | null>(null);
  const fetchingRef = useRef(false);

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

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除此便签？删除后可在回收站恢复。")) return;
    try {
      const res = await fetch(`/api/notes/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setNotes((prev) => prev.filter((n) => n.id !== id));
      if (selectedNoteId === id) setSelectedNoteId(null);
    } catch {
      alert("删除失败");
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
          className="flex items-center justify-center w-icon-btn h-icon-btn text-ink-muted hover:bg-white/[0.08] rounded-btn transition-colors"
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
        <div className="w-full md:w-80 border-r border-border-light flex flex-col bg-toolbar-bg overflow-y-auto scrollbar-thin">
          {loading ? (
            <div className="p-3 space-y-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-16 rounded-card bg-white/[0.06] animate-pulse"
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
                  onSelect={setSelectedNoteId}
                  onUnarchive={handleUnarchive}
                  onDelete={handleDelete}
                />
              ))}
              {regular.map((note) => (
                <ArchiveNoteItem
                  key={note.id}
                  note={note}
                  isSelected={selectedNoteId === note.id}
                  onSelect={setSelectedNoteId}
                  onUnarchive={handleUnarchive}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>

        {/* Detail panel - desktop */}
        <div className="hidden md:flex flex-1 flex-col bg-toolbar-bg">
          {selectedNote ? (
            <div className="flex-1 p-6 overflow-y-auto scrollbar-thin">
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
                      <div key={att.id} className="aspect-square rounded-thumb overflow-hidden bg-black/[0.03] cursor-pointer" onClick={() => setPreviewAtt(att)}>
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

        {/* Mobile detail */}
        {selectedNote && (
          <div className="flex md:hidden flex-1 flex-col bg-toolbar-bg p-4 overflow-y-auto">
            <div className="flex items-start gap-2 mb-4">
              <div
                className={`w-3 h-3 rounded-full mt-2 flex-shrink-0 ${ACCENT[selectedNote.color] || "bg-ink-muted/30"}`}
              />
              <h2 className="text-edit-title">
                {getAutoTitle(selectedNote)}
              </h2>
            </div>
            {selectedNote.mode === "checklist" && selectedNote.checklistItems?.length > 0 ? (
              <div className="flex-1 ml-5 space-y-1.5 overflow-y-auto">
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
                  <div key={att.id} className="aspect-square rounded-thumb overflow-hidden bg-black/[0.03] cursor-pointer" onClick={() => setPreviewAtt(att)}>
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
  onSelect,
  onUnarchive,
  onDelete,
}: {
  note: Note;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onUnarchive: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const accent = ACCENT[note.color] || "bg-accent-gray";
  const selected = SELECTED[note.color] || "bg-sel-gray";

  return (
    <div
      className={`relative rounded-card transition-colors ${
        isSelected ? selected : "hover:bg-white/[0.045]"
      }`}
    >
      <button
        onClick={() => onSelect(note.id)}
        className="w-full text-left"
      >
        <span
          className={`absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-full ${accent}`}
        />
        <div className="pl-4 pr-3.5 py-3">
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
                <span className="text-list-title text-ink truncate">
                  {getAutoTitle(note)}
                </span>
              </div>
              {getTodoProgress(note) && (
                <p className="text-list-meta text-ink-muted mt-0.5">
                  待办 {getTodoProgress(note)?.done}/{getTodoProgress(note)?.total}
                </p>
              )}
            </div>
          </div>
        </div>
      </button>
      <div className="flex gap-2 px-4 pb-2.5">
        <button
          onClick={() => onUnarchive(note.id)}
          className="text-list-meta text-primary hover:text-primary/80 transition-colors"
        >
          取消归档
        </button>
        <button
          onClick={() => onDelete(note.id)}
          className="text-list-meta text-danger hover:text-danger/80 transition-colors"
        >
          删除
        </button>
      </div>
    </div>
  );
}
