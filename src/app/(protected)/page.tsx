"use client";

import { useState } from "react";
import TopBar from "@/components/TopBar";
import NoteList from "@/components/NoteList";
import NoteEditor from "@/components/NoteEditor";
import { useNotes } from "@/hooks/useNotes";
import type { Note } from "@/types";

export default function HomePage() {
  const { notes, loading, searchQuery, setSearchQuery, fetchNotes, createNote, applyNote } =
    useNotes(false);

  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);

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

  return (
    <div className="h-screen flex flex-col bg-page-bg">
      <TopBar
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        onCreateNote={handleCreate}
        showEditor={showEditor}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Note list sidebar - hidden on mobile when editor is open */}
        <div
          className={`${showEditor ? "hidden" : "flex"} md:flex w-full md:w-[350px] flex-shrink-0 border-r border-black flex-col bg-sidebar-bg`}
        >
          <NoteList
            notes={notes}
            selectedId={selectedNoteId}
            onSelect={handleSelect}
            loading={loading}
            searchQuery={searchQuery}
          />
        </div>

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
