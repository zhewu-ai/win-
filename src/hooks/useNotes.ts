"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Note } from "@/types";
import { getDB } from "@/lib/offline/db";
import {
  ApiError,
  createNoteLocal,
  createNoteRemote,
  deleteNoteOfflineAware,
  isNetworkError,
  loadCachedNotes,
  mirrorNote,
  saveNoteUpdate,
} from "@/lib/offline/persist";

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
        if (!res.ok) throw new ApiError(res.status, "Failed to fetch");
        const data = await res.json();
        setNotes(data.notes);
        setError(null);
        // 在线成功 → 镜像到本地缓存
        void Promise.all((data.notes as Note[]).map((n) => mirrorNote(n)));
        // 全量拉取（无搜索）时以服务端为准清理本地已消失的 synced 便签：
        // 避免并发镜像把刚同步删除/他端删除的便签重新带回离线列表。
        if (!q) {
          const serverIds = new Set((data.notes as Note[]).map((n) => n.id));
          void getDB()
            .notes.where("syncStatus")
            .equals("synced")
            .and(
              (n) =>
                n.isArchived === archived &&
                n.serverId !== null &&
                !serverIds.has(n.serverId)
            )
            .delete();
        }
      } catch (e) {
        if (isNetworkError(e)) {
          // 离线/断网 → 从本地缓存回填
          const cached = await loadCachedNotes();
          setNotes(cached);
          setError(cached.length > 0 ? null : "离线，暂无本地便签缓存");
        } else {
          setError("加载便签失败");
        }
      } finally {
        setLoading(false);
        fetchingRef.current = false;
      }
    },
    [archived]
  );

  const createNote = useCallback(async (data?: Partial<Note>): Promise<Note> => {
    let note: Note;
    if (navigator.onLine) {
      try {
        note = await createNoteRemote(data);
      } catch (e) {
        if (isNetworkError(e)) note = await createNoteLocal(data);
        else throw e;
      }
    } else {
      note = await createNoteLocal(data);
    }
    setNotes((prev) => [note, ...prev]);
    return note;
  }, []);

  const updateNote = useCallback(
    async (id: string, data: Partial<Note>): Promise<Note> => {
      const updated = await saveNoteUpdate(id, data as Record<string, unknown>);
      setNotes((prev) => prev.map((n) => (n.id === id ? updated : n)));
      return updated;
    },
    []
  );

  // Local reconcile after an editor PATCH — no full list refresh (avoids flicker)
  const applyNote = useCallback((updated: Note) => {
    setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
  }, []);

  const deleteNote = useCallback(async (id: string) => {
    await deleteNoteOfflineAware(id);
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
