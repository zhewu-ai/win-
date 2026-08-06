"use client";

import { useSyncStatus } from "@/hooks/useSyncStatus";

export default function OfflineBar() {
  const { isOnline, isSyncing, pendingCount, hasError, retrySync } =
    useSyncStatus();

  if (isOnline && !isSyncing && !hasError && pendingCount === 0) return null;

  let text: string;
  let clickable = false;
  if (hasError) {
    text = "同步失败，点击重试";
    clickable = true;
  } else if (isSyncing) {
    text = "正在同步…";
  } else if (!isOnline) {
    text =
      pendingCount > 0
        ? "离线模式，修改已保存到本地"
        : "当前离线，暂无本地便签缓存";
  } else {
    text = `等待同步（${pendingCount}）`;
  }

  return (
    <div
      role="status"
      onClick={clickable ? () => void retrySync() : undefined}
      className={`flex-shrink-0 flex items-center justify-center gap-1.5 px-3 py-1 text-xs bg-toolbar-bg border-b border-border-light text-ink-secondary ${
        clickable ? "cursor-pointer hover:text-ink" : ""
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          hasError ? "bg-danger" : isSyncing ? "bg-primary animate-pulse" : "bg-ink-muted/60"
        }`}
      />
      {text}
    </div>
  );
}
