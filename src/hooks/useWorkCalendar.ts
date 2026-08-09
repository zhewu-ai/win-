"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  QuickWeekPreviewRow,
  WorkProject,
  WorkProjectInput,
  WorkProjectStatus,
  WorkScheduleItem,
  WorkScheduleItemInput,
} from "@/types";

// 工作日历数据 hook：项目 + 排期条目，范围拉取 + 增删改，带乐观更新与失败回滚。
// 项目/条目均只属于当前管理员，接口层已校验。

export function useWorkCalendar() {
  const [projects, setProjects] = useState<WorkProject[]>([]);
  const [items, setItems] = useState<WorkScheduleItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const projectsRef = useRef<WorkProject[]>([]);
  const itemsRef = useRef<WorkScheduleItem[]>([]);
  useEffect(() => {
    projectsRef.current = projects;
  }, [projects]);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const fetchProjects = useCallback(async (includeArchived = false) => {
    try {
      const res = await fetch(
        `/api/work-projects${includeArchived ? "?status=all" : ""}`
      );
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "FETCH_FAILED");
      setProjects(data.projects as WorkProject[]);
      setError(null);
    } catch {
      setError("加载项目失败");
    }
  }, []);

  const fetchItems = useCallback(async (from?: string, to?: string) => {
    setLoading(true);
    try {
      const qs =
        from && to ? `?from=${from}&to=${to}` : "";
      const res = await fetch(`/api/work-schedule-items${qs}`);
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "FETCH_FAILED");
      setItems(data.items as WorkScheduleItem[]);
      setError(null);
      return data.items as WorkScheduleItem[];
    } catch {
      setError("加载排期失败");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const createProject = useCallback(
    async (input: WorkProjectInput): Promise<WorkProject> => {
      const res = await fetch("/api/work-projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "CREATE_FAILED");
      setProjects((prev) => [...prev, data.project as WorkProject]);
      return data.project as WorkProject;
    },
    []
  );

  const updateProject = useCallback(
    async (
      id: string,
      patch: Partial<WorkProjectInput> & { status?: WorkProjectStatus }
    ): Promise<WorkProject> => {
      const snapshot = projectsRef.current;
      setProjects((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...patch } : p))
      );
      try {
        const res = await fetch(`/api/work-projects/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || "UPDATE_FAILED");
        setProjects((prev) =>
          prev.map((p) => (p.id === id ? data.project : p))
        );
        return data.project as WorkProject;
      } catch (e) {
        setProjects(snapshot);
        throw e;
      }
    },
    []
  );

  const deleteProject = useCallback(async (id: string): Promise<void> => {
    const snapshot = projectsRef.current;
    setProjects((prev) => prev.filter((p) => p.id !== id));
    try {
      const res = await fetch(`/api/work-projects/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "DELETE_FAILED");
    } catch (e) {
      setProjects(snapshot);
      throw e;
    }
  }, []);

  const createItem = useCallback(
    async (input: WorkScheduleItemInput): Promise<WorkScheduleItem> => {
      const res = await fetch("/api/work-schedule-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "CREATE_FAILED");
      setItems((prev) => [...prev, data.item as WorkScheduleItem]);
      return data.item as WorkScheduleItem;
    },
    []
  );

  const updateItem = useCallback(
    async (
      id: string,
      patch: Partial<WorkScheduleItemInput>
    ): Promise<WorkScheduleItem> => {
      const snapshot = itemsRef.current;
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, ...patch } : i))
      );
      try {
        const res = await fetch(`/api/work-schedule-items/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || "UPDATE_FAILED");
        setItems((prev) =>
          prev.map((i) => (i.id === id ? data.item : i))
        );
        return data.item as WorkScheduleItem;
      } catch (e) {
        setItems(snapshot);
        throw e;
      }
    },
    []
  );

  const deleteItem = useCallback(async (id: string): Promise<void> => {
    const snapshot = itemsRef.current;
    setItems((prev) => prev.filter((i) => i.id !== id));
    try {
      const res = await fetch(`/api/work-schedule-items/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "DELETE_FAILED");
    } catch (e) {
      setItems(snapshot);
      throw e;
    }
  }, []);

  const quickWeekPreview = useCallback(
    async (input: {
      projectId: string;
      weekStart: string;
      days: Record<string, string>;
      nodes: { date: string; title: string }[];
    }): Promise<QuickWeekPreviewRow[]> => {
      const res = await fetch("/api/work-schedule-items/quick-week", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "PREVIEW_FAILED");
      return data.preview as QuickWeekPreviewRow[];
    },
    []
  );

  return {
    projects,
    items,
    loading,
    error,
    fetchProjects,
    fetchItems,
    createProject,
    updateProject,
    deleteProject,
    createItem,
    updateItem,
    deleteItem,
    quickWeekPreview,
  };
}
