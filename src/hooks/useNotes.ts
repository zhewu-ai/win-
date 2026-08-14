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
  mergeLocalPending,
  mirrorNote,
  saveNoteUpdate,
} from "@/lib/offline/persist";

export function useNotes(archived = false) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const fetchingRef = useRef(false);

  /**
   * 拉取列表。silent = 手动/后台刷新：不触发列表 loading 骨架屏；失败时不改写当前列表，
   * 避免服务器旧快照覆盖本机未同步内容。返回 Note[] 成功；null 失败；undefined 已有请求在途。
   */
  const fetchNotes = useCallback(
    async (
      q?: string,
      opts?: { silent?: boolean }
    ): Promise<Note[] | null | undefined> => {
      if (fetchingRef.current) return undefined;
      fetchingRef.current = true;
      const silent = opts?.silent ?? false;
      if (silent) setRefreshing(true);
      else setLoading(true);

      try {
        const params = new URLSearchParams();
        params.set("archived", String(archived));
        if (q) params.set("q", q);

        const res = await fetch(`/api/notes?${params}`);
        if (!res.ok) throw new ApiError(res.status, "Failed to fetch");
        const data = await res.json();
        const fetched = data.notes as Note[];
        // 把本地 pending/syncError 记录合并进内存列表再展示：
        // 服务器旧快照不得吞掉本地较新内容/离线新建（mirrorNote 只保护 IndexedDB，这里补内存层）。
        let merged = fetched;
        try {
          merged = await mergeLocalPending(fetched, archived);
        } catch {
          // IndexedDB 不可用时退化为纯服务器快照，不阻断本次刷新
        }
        setNotes(merged);
        setError(null);
        // 在线成功 → 镜像到本地缓存
        void Promise.all(fetched.map((n) => mirrorNote(n)));
        // 全量拉取（无搜索）时以服务端为准清理本地已消失的 synced 便签：
        // 避免并发镜像把刚同步删除/他端删除的便签重新带回离线列表。
        if (!q) {
          const serverIds = new Set(fetched.map((n) => n.id));
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
        return fetched;
      } catch (e) {
        if (silent) return null; // 静默刷新失败：不改动当前列表，交由调用方提示
        if (isNetworkError(e)) {
          // 离线/断网 → 从本地缓存回填
          const cached = await loadCachedNotes();
          setNotes(cached);
          setError(cached.length > 0 ? null : "离线，暂无本地便签缓存");
        } else {
          setError("加载便签失败");
        }
        return null;
      } finally {
        if (silent) setRefreshing(false);
        else setLoading(false);
        fetchingRef.current = false;
      }
    },
    [archived]
  );

  const createNote = useCallback(async (data?: Partial<Note>): Promise<Note> => {
    let note: Note;
    try {
      note = await createNoteRemote(data);
    } catch (e) {
      // 网络错误或服务器 5xx：转本地新建（pendingCreate），避免新建意图丢失
      if (isNetworkError(e) || (e instanceof ApiError && e.status >= 500)) {
        note = await createNoteLocal(data);
      } else {
        throw e;
      }
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

  // Local reconcile after an editor PATCH — no full list refresh (avoids flicker).
  // M11.1: 内部链接 fallback 打开「当前列表没有的目标便签」时按 upsert 插入列表，
  // 已有项（常规编辑路径）行为不变：仅 map 更新。
  const applyNote = useCallback((updated: Note) => {
    setNotes((prev) => {
      const exists = prev.some((n) => n.id === updated.id);
      return exists
        ? prev.map((n) => (n.id === updated.id ? updated : n))
        : [updated, ...prev];
    });
  }, []);

  const deleteNote = useCallback(async (id: string) => {
    await deleteNoteOfflineAware(id);
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  // Refresh on tab visibility change（静默：回到标签页不闪骨架屏）
  useEffect(() => {
    const handler = () => {
      if (!document.hidden) fetchNotes(searchQuery || undefined, { silent: true });
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [fetchNotes, searchQuery]);

  return {
    notes,
    loading,
    refreshing,
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
