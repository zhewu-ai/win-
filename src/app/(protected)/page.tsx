"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import NoteEditor from "@/components/NoteEditor";
import { useNotes } from "@/hooks/useNotes";
import { useNarrowMode } from "@/hooks/useNarrowMode";
import type { Note } from "@/types";

const SIDEBAR_COLLAPSED_KEY = "sticky-notes.sidebarCollapsed";

export default function HomePage() {
  const { notes, loading, searchQuery, setSearchQuery, fetchNotes, createNote, applyNote } =
    useNotes(false);

  // 极窄窗口（<520px）进入单栏模式；桌面窗口 520px 以上始终双栏，迟滞防横跳
  const isNarrow = useNarrowMode();
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
      const res = await fetch(`/api/notes/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
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
      <div className="flex-1 flex overflow-hidden">
        {/* 侧边栏：
            窄屏单栏 → 编辑打开时隐藏，否则全宽显示；
            宽屏双栏 → 仅随用户折叠状态显示/隐藏。 */}
        <div
          className={`${
            isNarrow ? (!showEditor ? "flex" : "hidden") : sidebarCollapsed ? "hidden" : "flex"
          } ${
            isNarrow ? "w-full" : "w-[350px]"
          } flex-shrink-0 border-r border-black flex-col bg-sidebar-bg`}
        >
          <Sidebar
            notes={notes}
            selectedId={selectedNoteId}
            onSelect={handleSelect}
            loading={loading}
            searchQuery={searchQuery}
            onSearchChange={handleSearchChange}
            onCreateNote={handleCreate}
            onCollapse={isNarrow ? undefined : toggleSidebar}
          />
        </div>

        {/* 折叠后的展开条 - 仅宽屏双栏 */}
        {!isNarrow && sidebarCollapsed && (
          <button
            onClick={toggleSidebar}
            className="w-7 flex-shrink-0 items-center justify-center bg-sidebar-bg border-r border-black text-ink-muted hover:text-ink hover:bg-white/[0.05] transition-colors flex"
            title="展开侧边栏"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}

        {/* 编辑器：窄屏单栏时编辑打开才显示；宽屏始终显示 */}
        <div
          className={`${
            isNarrow && !showEditor ? "hidden" : "flex"
          } flex-1 flex-col`}
        >
          <NoteEditor
            note={selectedNote}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            onArchive={handleArchive}
            onNewNote={handleCreate}
            showBackButton={isNarrow}
            onBack={handleBack}
          />
        </div>
      </div>
    </div>
  );
}
