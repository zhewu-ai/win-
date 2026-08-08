"use client";

import { useSyncStatus } from "@/hooks/useSyncStatus";
import type { SyncStatus } from "@/types";

interface Props {
  status: "saved" | "saving" | "error" | "localError";
  onRetry?: () => void;
  showText?: boolean;
  syncStatus?: SyncStatus;
}

export default function SaveStatus({
  status,
  onRetry,
  showText = true,
  syncStatus,
}: Props) {
  const { isOnline, isSyncing } = useSyncStatus();
  const textCls = showText ? "inline" : "hidden";

  if (status === "saving") {
    return (
      <span className="text-list-meta text-ink-muted/60 flex items-center gap-1 whitespace-nowrap">
        <span className="w-1.5 h-1.5 bg-ink-muted/40 rounded-full animate-pulse" />
        <span className={textCls}>保存中</span>
      </span>
    );
  }

  if (status === "localError") {
    return (
      <span className="text-list-meta text-danger flex items-center gap-1 whitespace-nowrap">
        <span className="w-1.5 h-1.5 bg-danger rounded-full animate-pulse" />
        <span className={textCls}>保存失败，请不要关闭窗口</span>
      </span>
    );
  }

  if (status === "error") {
    return (
      <span className="text-list-meta text-danger flex items-center gap-1 whitespace-nowrap">
        <span className="w-1.5 h-1.5 bg-danger rounded-full" />
        <span className={textCls}>
          保存失败
          {onRetry && (
            <button
              onClick={onRetry}
              className="underline hover:text-danger/80 font-medium"
            >
              重试
            </button>
          )}
        </span>
      </span>
    );
  }

  // saved：按同步状态给出明确文案，避免离线误显示“已同步”
  const pending =
    syncStatus === "pendingCreate" ||
    syncStatus === "pendingUpdate" ||
    syncStatus === "pendingDelete";

  // M10.13 常态隐藏：本机已保存且无待同步、无同步失败 → 不渲染、不占位，
  // 把稳定位置让给刷新按钮，避免「已保存」低价值文案长期占用工具栏。
  if (!pending && syncStatus !== "syncError") {
    return null;
  }

  let label = "已保存";
  let dotCls = "bg-ink-muted/30";
  if (syncStatus === "syncError") {
    label = "同步失败，内容已保存在本地";
    dotCls = "bg-danger";
  } else if (pending) {
    if (!isOnline) {
      label = "已保存到本地，等待联网同步";
      dotCls = "bg-primary/70";
    } else if (isSyncing) {
      label = "同步中";
      dotCls = "bg-primary animate-pulse";
    } else {
      label = "等待同步";
      dotCls = "bg-primary/70";
    }
  }

  return (
    <span className="text-list-meta text-ink-muted/40 flex items-center gap-1 whitespace-nowrap">
      <span className={`w-1.5 h-1.5 ${dotCls} rounded-full`} />
      <span className={textCls}>{label}</span>
    </span>
  );
}
