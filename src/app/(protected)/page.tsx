"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import NoteEditor from "@/components/NoteEditor";
import { useNotes } from "@/hooks/useNotes";
import type { Note } from "@/types";

const SIDEBAR_COLLAPSED_KEY = "sticky-notes.sidebarCollapsed";

export default function HomePage() {
  const { notes, loading, searchQuery, setSearchQuery, fetchNotes, createNote, applyNote } =
    useNotes(false);

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
        {/* Sidebar - hidden on mobile when editor is open; collapsible on wide */}
        <div
          className={`${showEditor ? "hidden" : "flex"} ${
            sidebarCollapsed ? "md:hidden" : "md:flex"
          } w-full md:w-[350px] flex-shrink-0 border-r border-black flex-col bg-sidebar-bg`}
        >
          <Sidebar
            notes={notes}
            selectedId={selectedNoteId}
            onSelect={handleSelect}
            loading={loading}
            searchQuery={searchQuery}
            onSearchChange={handleSearchChange}
            onCreateNote={handleCreate}
            onCollapse={toggleSidebar}
          />
        </div>

        {/* Collapsed expand strip - wide only */}
        {sidebarCollapsed && (
          <button
            onClick={toggleSidebar}
            className="hidden md:flex w-7 flex-shrink-0 items-center justify-center bg-sidebar-bg border-r border-black text-ink-muted hover:text-ink hover:bg-white/[0.05] transition-colors"
            title="展开侧边栏"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}

        {/* Editor */}
        <div
          className={`${!showEditor && !selectedNote ? "hidden" : "flex"} md:flex flex-1 flex-col`}
        >
          <NoteEditor
            note={selectedNote}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            onArchive={handleArchive}
            onNewNote={handleCreate}
            showBackButton={true}
            onBack={handleBack}
          />
        </div>
      </div>
    </div>
  );
}
