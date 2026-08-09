"use client";

import type { CalendarImportStage } from "@/types";

// M13 AI 排期导入 2.1：5 阶段进度反馈（上传文件 → 读取内容 → AI 识别 → 整理草稿 → 等待确认）。
// 每阶段有状态图标；AI 阶段实时显示已等待秒数（>3s 持续反馈）；失败时定位失败阶段并显示错误与重试入口。

interface Props {
  stages: CalendarImportStage[];
  elapsed?: number;
  failed?: boolean;
  onRetry?: () => void;
}

export default function ImportStepPanel({ stages, elapsed = 0, failed = false, onRetry }: Props) {
  const failedStage = stages.find((s) => s.status === "error");
  return (
    <div className="my-1.5 space-y-1 rounded-card border border-border-light bg-panel-bg p-2">
      {stages.map((s) => (
        <div key={s.id} className="flex items-center gap-1.5 text-[11px] leading-tight">
          <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center">
            {s.status === "done" ? (
              <svg className="h-3.5 w-3.5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : s.status === "error" ? (
              <svg className="h-3.5 w-3.5 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : s.status === "active" ? (
              <svg className="h-3.5 w-3.5 animate-spin text-primary" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            ) : (
              <span className="h-1.5 w-1.5 rounded-full bg-border-strong/40" />
            )}
          </span>
          <span
            className={
              s.status === "error"
                ? "text-danger"
                : s.status === "active"
                  ? "font-medium text-ink"
                  : s.status === "done"
                    ? "text-ink-secondary"
                    : "text-ink-muted"
            }
          >
            {s.label}
          </span>
          {s.status === "active" && s.id === "ai" && (
            <span className="ml-auto text-ink-muted">已等待 {elapsed}s…</span>
          )}
        </div>
      ))}
      {failed && (
        <div className="pt-1">
          {failedStage?.error && <p className="pb-1 text-[11px] text-danger">{failedStage.error}</p>}
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="rounded-btn bg-primary px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-primary/90"
            >
              重试识别
            </button>
          )}
          {!onRetry && <span className="text-xs text-ink-muted">可重新选择文件重试</span>}
        </div>
      )}
    </div>
  );
}
