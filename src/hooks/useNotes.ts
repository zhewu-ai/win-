"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Note } from "@/types";

export function useNotes(archived = false) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const fetchingRef = useRef(false);

  const fetchNotes = useCallback(
    async (q?: string) => {
      if (fetchingRef.current) return;
      fetchingRef.current = true;

      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("archived", String(archived));
        if (q) params.set("q", q);

        const res = await fetch(`/api/notes?${params}`);
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        setNotes(data.notes);
        setError(null);
      } catch {
        setError("加载便签失败");
      } finally {
        setLoading(false);
        fetchingRef.current = false;
      }
    },
    [archived]
  );

  const createNote = useCallback(async (data?: Partial<Note>) => {
    const res = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data || { title: "", content: "", color: "yellow" }),
    });
    if (!res.ok) throw new Error("Failed to create note");
    const note = await res.json();
    setNotes((prev) => [note, ...prev]);
    return note as Note;
  }, []);

  const updateNote = useCallback(
    async (id: string, data: Partial<Note>): Promise<Note> => {
      const res = await fetch(`/api/notes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update note");
      const updated = await res.json();
      setNotes((prev) => prev.map((n) => (n.id === id ? updated : n)));
      return updated as Note;
    },
    []
  );

  // Local reconcile after an editor PATCH — no full list refresh (avoids flicker)
  const applyNote = useCallback((updated: Note) => {
    setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
  }, []);

  const deleteNote = useCallback(async (id: string) => {
    const res = await fetch(`/api/notes/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete note");
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  // Refresh on tab visibility change
  useEffect(() => {
    const handler = () => {
      if (!document.hidden) fetchNotes(searchQuery || undefined);
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [fetchNotes, searchQuery]);

  return {
    notes,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    fetchNotes,
    createNote,
    updateNote,
    applyNote,
    deleteNote,
  };
}
