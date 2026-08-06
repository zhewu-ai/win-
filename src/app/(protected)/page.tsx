"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import NoteEditor from "@/components/NoteEditor";
import OfflineBar from "@/components/OfflineBar";
import { useNotes } from "@/hooks/useNotes";
import { useLayoutMode } from "@/hooks/useLayoutMode";
import { deleteNoteOfflineAware } from "@/lib/offline/persist";
import type { Note } from "@/types";

const SIDEBAR_COLLAPSED_KEY = "sticky-notes.sidebarCollapsed";

export default function HomePage() {
  const { notes, loading, searchQuery, setSearchQuery, fetchNotes, createNote, applyNote } =
    useNotes(false);

  // 布局模式：≥720 双栏（侧栏固定 350px，仅手动折叠）/ <720 单栏（工具栏再按编辑区实际宽度细分）
  const mode = useLayoutMode();
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
  });

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        // localStorage may be unavailable; collapse still applies for this session
      }
      return next;
    });
  };

  const selectedNote = notes.find((n) => n.id === selectedNoteId) || null;

  const handleCreate = async () => {
    try {
      const note = await createNote();
      setSelectedNoteId(note.id);
      setShowEditor(true);
    } catch {
      alert("新建便签失败");
    }
  };

  const handleSelect = (id: string) => {
    setSelectedNoteId(id);
    setShowEditor(true);
  };

  const handleBack = () => {
    setShowEditor(false);
    setSelectedNoteId(null);
  };

  const handleUpdate = (updated: Note) => {
    applyNote(updated);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteNoteOfflineAware(id);
      if (selectedNoteId === id) {
        setSelectedNoteId(null);
        setShowEditor(false);
      }
      fetchNotes(searchQuery || undefined);
    } catch {
      alert("删除便签失败");
    }
  };

  const handleArchive = async (id: string) => {
    if (selectedNoteId === id) {
      setSelectedNoteId(null);
      setShowEditor(false);
    }
    fetchNotes(searchQuery || undefined);
  };

  const handleSearchChange = (q: string) => {
    setSearchQuery(q);
    fetchNotes(q || undefined);
  };

  useEffect(() => {
    const onChanged = (e: Event) => {
      const detail = (e as CustomEvent<{ deletedId?: string }>).detail;
      if (detail?.deletedId && detail.deletedId === selectedNoteId) {
        setSelectedNoteId(null);
        setShowEditor(false);
      }
      fetchNotes(searchQuery || undefined);
    };
    window.addEventListener("sticky-notes:changed", onChanged);
    return () => window.removeEventListener("sticky-notes:changed", onChanged);
  }, [fetchNotes, searchQuery, selectedNoteId]);

  return (
    <div className="h-screen flex flex-col bg-page-bg">
      <OfflineBar />
      <div className="flex-1 flex overflow-hidden">
        {/* 侧边栏：
            单栏 → 编辑打开时隐藏，否则全宽显示；
            双栏 → 固定 350px，仅随用户手动折叠状态隐藏（w-0+opacity 过渡动画），不随窗口缩放自动变化。 */}
        <div
          className={`${
            mode === "single"
              ? !showEditor
                ? "flex w-full border-r border-border-light"
                : "hidden"
              : sidebarCollapsed
                ? "flex w-0 opacity-0 overflow-hidden pointer-events-none"
                : "flex w-[350px] border-r border-border-light"
          } flex-shrink-0 flex-col bg-sidebar-bg transition-[width,opacity] duration-150 ease-out`}
        >
          <Sidebar
            notes={notes}
            selectedId={selectedNoteId}
            onSelect={handleSelect}
            loading={loading}
            searchQuery={searchQuery}
            onSearchChange={handleSearchChange}
            onCreateNote={handleCreate}
            onCollapse={mode === "single" ? undefined : toggleSidebar}
          />
        </div>

        {/* 折叠后的展开条 - 仅双栏 */}
        {mode !== "single" && sidebarCollapsed && (
          <button
            onClick={toggleSidebar}
            className="w-7 flex-shrink-0 items-center justify-center bg-sidebar-bg border-r border-border-light text-ink-muted hover:text-ink hover:bg-surface-hover transition-colors flex"
            title="展开侧边栏"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}

        {/* 编辑器：单栏时编辑打开才显示；双栏始终显示 */}
        <div
          className={`${
            mode === "single" && !showEditor ? "hidden" : "flex"
          } flex-1 flex-col`}
        >
          <NoteEditor
            note={selectedNote}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            onArchive={handleArchive}
            onNewNote={handleCreate}
            showBackButton={mode === "single"}
            onBack={handleBack}
          />
        </div>
      </div>
    </div>
  );
}
