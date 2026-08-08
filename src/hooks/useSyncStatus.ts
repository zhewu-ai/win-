"use client";

import { useEffect, useState, useCallback } from "react";
import { liveQuery } from "dexie";
import { getDB } from "@/lib/offline/db";
import { onSyncStateChange, runSync } from "@/lib/offline/sync";

// 在线状态：单例共享，供多个组件订阅
let currentOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
const onlineListeners = new Set<(v: boolean) => void>();

function setOnline(v: boolean) {
  if (currentOnline === v) return;
  currentOnline = v;
  onlineListeners.forEach((fn) => fn(v));
}

let loopStarted = false;
function ensureSyncLoop() {
  if (loopStarted) return;
  loopStarted = true;
  if (typeof window === "undefined") return;
  window.addEventListener("online", () => {
    setOnline(true);
    void runSync();
  });
  window.addEventListener("offline", () => setOnline(false));
  // 后台轻量重试：无待同步内容时不触发 runSync，避免 isSyncing 空转导致 UI 闪跳
  window.setInterval(() => {
    if (!navigator.onLine) return;
    void (async () => {
      const pending = await getDB()
        .notes.where("syncStatus")
        .anyOf(["pendingCreate", "pendingUpdate", "pendingDelete", "syncError"])
        .count();
      if (pending > 0) void runSync();
    })();
  }, 30000);
  if (navigator.onLine) void runSync();
}

export function useSyncStatus() {
  const [isOnline, setIsOnline] = useState(currentOnline);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    ensureSyncLoop();
    onlineListeners.add(setIsOnline);
    const offSync = onSyncStateChange(setIsSyncing);
    return () => {
      onlineListeners.delete(setIsOnline);
      offSync();
    };
  }, []);

  useEffect(() => {
    const sub = liveQuery(() =>
      getDB()
        .notes.where("syncStatus")
        .anyOf(["pendingCreate", "pendingUpdate", "pendingDelete"])
        .count()
    ).subscribe({
      next: setPendingCount,
      error: () => {},
    });
    return () => sub.unsubscribe();
  }, []);

  useEffect(() => {
    const sub = liveQuery(() =>
      getDB().notes.where("syncStatus").equals("syncError").count()
    ).subscribe({
      next: (n) => setHasError(n > 0),
      error: () => {},
    });
    return () => sub.unsubscribe();
  }, []);

  const retrySync = useCallback(async () => {
    await runSync();
  }, []);

  return { isOnline, isSyncing, pendingCount, hasError, retrySync };
}
