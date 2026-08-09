"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CalendarEvent, CalendarEventInput } from "@/types";

// 日历事件数据 hook：范围拉取 + 增删改，带乐观更新与失败回滚。
// 单日历页内实例共享 events 状态；今日条用独立实例各自拉今天。

export function useCalendarEvents() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventsRef = useRef<CalendarEvent[]>([]);
  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  const fetchRange = useCallback(
    async (from: string, to: string): Promise<CalendarEvent[] | null> => {
      setLoading(true);
      try {
        const res = await fetch(`/api/calendar-events?from=${from}&to=${to}`);
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || "FETCH_FAILED");
        setEvents(data.events);
        setError(null);
        return data.events as CalendarEvent[];
      } catch {
        setError("加载日历事件失败");
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const createEvent = useCallback(async (input: CalendarEventInput): Promise<CalendarEvent> => {
    const res = await fetch("/api/calendar-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error || "CREATE_FAILED");
    }
    setEvents((prev) => [...prev, data.event]);
    return data.event as CalendarEvent;
  }, []);

  const updateEvent = useCallback(
    async (id: string, patch: Partial<CalendarEventInput>): Promise<CalendarEvent> => {
      const snapshot = eventsRef.current;
      // 乐观更新：先应用本地补丁，失败再整体回滚
      setEvents((prev) =>
        prev.map((e) => (e.id === id ? { ...e, ...patch } : e))
      );
      try {
        const res = await fetch(`/api/calendar-events/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || "UPDATE_FAILED");
        setEvents((prev) => prev.map((e) => (e.id === id ? data.event : e)));
        return data.event as CalendarEvent;
      } catch (e) {
        setEvents(snapshot);
        throw e;
      }
    },
    []
  );

  const deleteEvent = useCallback(
    async (id: string): Promise<void> => {
      const snapshot = eventsRef.current;
      setEvents((prev) => prev.filter((e) => e.id !== id));
      try {
        const res = await fetch(`/api/calendar-events/${id}`, { method: "DELETE" });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || "DELETE_FAILED");
      } catch (e) {
        setEvents(snapshot);
        throw e;
      }
    },
    []
  );

  return { events, loading, error, fetchRange, createEvent, updateEvent, deleteEvent };
}
