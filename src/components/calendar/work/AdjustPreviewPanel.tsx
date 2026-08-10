"use client";

import { useState } from "react";
import type {
  CalendarImportUsage,
  ScheduleAdjustmentApplyChange,
  ScheduleAdjustmentChange,
  ScheduleAdjustmentDraft,
} from "@/types";

// M13 AI 自然语言调整排期预览：展示 AI 生成的变更草稿（新增/修改/不变），
// 支持逐条勾选应用/跳过、手动编辑标题与起止日期，用户确认后由父级调用 apply 接口。
// AI 结果必须经用户确认后才写库。

interface Props {
  draft: ScheduleAdjustmentDraft;
  projectId: string;
  projectName: string;
  usage?: CalendarImportUsage | null;
  busy?: boolean;
  error?: string | null;
  onApply: (changes: ScheduleAdjustmentApplyChange[]) => void;
  onCancel: () => void;
}

const inputCls =
  "w-full px-2 py-1 text-xs text-ink bg-panel-bg border border-border-light rounded-input outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15 transition-all";

const CONFIDENCE_LABEL: Record<ScheduleAdjustmentDraft["confidence"], string> = {
  high: "置信度高",
  medium: "置信度中",
  low: "置信度低",
};

const CONFIDENCE_CLS: Record<ScheduleAdjustmentDraft["confidence"], string> = {
  high: "bg-green-500/15 text-green-600",
  medium: "bg-amber-500/15 text-amber-600",
  low: "bg-danger/10 text-danger",
};

export default function AdjustPreviewPanel({
  draft,
  projectId,
  projectName,
  usage,
  busy,
  error,
  onApply,
  onCancel,
}: Props) {
  const [skipped, setSkipped] = useState<Set<number>>(() => new Set());
  const [edits, setEdits] = useState<Record<number, { title: string; startDate: string; endDate: string }>>({});

  const toggle = (idx: number) => {
    setSkipped((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const edit = (idx: number, patch: Partial<{ title: string; startDate: string; endDate: string }>) => {
    setEdits((prev) => ({ ...prev, [idx]: { ...(prev[idx] ?? {}), ...patch } }));
  };

  const effective = (change: ScheduleAdjustmentChange, idx: number) => {
    const e = edits[idx];
    if (change.type === "create") {
      return {
        title: e?.title ?? change.title,
        startDate: e?.startDate ?? change.startDate,
        endDate: e?.endDate ?? change.endDate,
      };
    }
    if (change.type === "update") {
      return {
        title: e?.title ?? change.after.title,
        startDate: e?.startDate ?? change.after.startDate,
        endDate: e?.endDate ?? change.after.endDate,
      };
    }
    return null;
  };

  const appliedChanges: ScheduleAdjustmentApplyChange[] = [];
  draft.changes.forEach((c, idx) => {
    if (skipped.has(idx) || c.type === "noop") return;
    const eff = effective(c, idx);
    if (!eff) return;
    if (c.type === "create") {
      appliedChanges.push({
        type: "create",
        projectId,
        title: eff.title,
        startDate: eff.startDate,
        endDate: eff.endDate,
        reason: c.reason,
      });
    } else if (c.type === "update") {
      appliedChanges.push({
        type: "update",
        projectId,
        itemId: c.itemId,
        title: eff.title,
        startDate: eff.startDate,
        endDate: eff.endDate,
        reason: c.reason,
      });
    }
  });

  const confirmDisabled = busy || appliedChanges.length === 0;
  const needInfo = draft.confidence === "low" && draft.changes.length === 0;

  return (
    <div className="flex flex-col gap-3 px-3 pt-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[13px] font-bold text-ink">调整预览</h2>
        <div className="flex items-center gap-1.5">
          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${CONFIDENCE_CLS[draft.confidence]}`}>
            {CONFIDENCE_LABEL[draft.confidence]}
          </span>
          {usage && (
            <span className="text-[10px] text-ink-muted">
              {usage.model.replace("Qwen/", "")} · {(usage.durationMs / 1000).toFixed(1)}s
            </span>
          )}
        </div>
      </div>

      {draft.summary && <p className="text-xs leading-relaxed text-ink-secondary">{draft.summary}</p>}

      {needInfo && (
        <div className="rounded-card bg-amber-500/10 px-3 py-2">
          <p className="text-xs font-semibold text-amber-600">需要补充信息</p>
          <ul className="mt-1 space-y-0.5 text-[11px] leading-relaxed text-ink-secondary">
            {draft.warnings.length > 0 ? (
              draft.warnings.map((w, i) => <li key={i}>· {w}</li>)
            ) : (
              <li>· 请补充：要调整哪个节点？提前还是延期？调整到哪一天？</li>
            )}
          </ul>
        </div>
      )}

      {!needInfo && draft.warnings.length > 0 && (
        <div className="rounded-card bg-amber-500/10 px-3 py-2">
          <p className="text-xs font-semibold text-amber-600">提示</p>
          <ul className="mt-1 space-y-0.5 text-[11px] leading-relaxed text-ink-secondary">
            {draft.warnings.map((w, i) => (
              <li key={i}>· {w}</li>
            ))}
          </ul>
        </div>
      )}

      {draft.changes.length === 0 && !needInfo && (
        <p className="rounded-card bg-surface-strong/50 px-3 py-4 text-center text-sm text-ink-muted">
          AI 未生成可应用的变更，请调整描述后重试。
        </p>
      )}

      <div className="flex flex-col gap-2">
        {draft.changes.map((c, idx) => (
          <ChangeRow
            key={idx}
            idx={idx}
            change={c}
            skipped={skipped.has(idx)}
            projectName={projectName}
            edit={edits[idx]}
            onToggle={() => toggle(idx)}
            onEdit={(patch) => edit(idx, patch)}
          />
        ))}
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}

      <div className="sticky bottom-0 -mx-3 mt-2 flex items-center gap-2 border-t border-border-light bg-sidebar-bg/95 px-3 pb-2 pt-2 backdrop-blur">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded-btn px-3 py-1.5 text-sm font-semibold text-ink-secondary transition-colors hover:bg-surface-hover disabled:opacity-50"
        >
          取消
        </button>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => onApply(appliedChanges)}
          disabled={confirmDisabled}
          className="rounded-btn bg-primary px-3.5 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {busy ? "更新中..." : `确认更新排期（${appliedChanges.length}）`}
        </button>
      </div>
    </div>
  );
}

function ChangeRow({
  idx,
  change,
  skipped,
  projectName,
  edit,
  onToggle,
  onEdit,
}: {
  idx: number;
  change: ScheduleAdjustmentChange;
  skipped: boolean;
  projectName: string;
  edit?: { title: string; startDate: string; endDate: string };
  onToggle: () => void;
  onEdit: (patch: Partial<{ title: string; startDate: string; endDate: string }>) => void;
}) {
  if (change.type === "noop") {
    return (
      <div className="rounded-card border border-border-light bg-panel-bg p-2 opacity-70">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-secondary">
          <svg className="h-3.5 w-3.5 flex-shrink-0 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
          </svg>
          不变
          {change.itemId && <span className="truncate text-[10px] font-normal text-ink-muted">{change.reason}</span>}
        </div>
        {!change.itemId && <p className="mt-1 text-[11px] text-ink-muted">{change.reason}</p>}
      </div>
    );
  }

  const title = edit?.title ?? (change.type === "create" ? change.title : change.after.title);
  const startDate = edit?.startDate ?? (change.type === "create" ? change.startDate : change.after.startDate);
  const endDate = edit?.endDate ?? (change.type === "create" ? change.endDate : change.after.endDate);

  return (
    <div className={`rounded-card border border-border-light bg-panel-bg p-2 ${skipped ? "opacity-50" : ""}`}>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onToggle}
          aria-label={skipped ? "应用该变更" : "跳过该变更"}
          title={skipped ? "点击应用" : "点击跳过"}
          className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border transition-colors ${
            skipped
              ? "border-border-strong bg-surface-strong text-transparent hover:text-ink-muted"
              : "border-primary bg-primary/10 text-primary"
          }`}
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </button>
        <span className={`flex-shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
          change.type === "create" ? "bg-green-500/15 text-green-600" : "bg-blue-500/15 text-blue-600"
        }`}>
          {change.type === "create" ? "新增" : "修改"}
        </span>
        {change.type === "create" && (
          <span className="truncate text-[10px] text-ink-muted">项目：{projectName}</span>
        )}
      </div>

      <input
        type="text"
        value={title}
        onChange={(e) => onEdit({ title: e.target.value })}
        maxLength={120}
        disabled={skipped}
        className="mt-1.5 min-w-0 w-full bg-transparent text-xs font-medium text-ink outline-none focus:bg-surface-hover/60 rounded-input px-1.5 py-0.5 disabled:opacity-60"
        aria-label="排期标题"
      />

      {change.type === "update" && (
        <p className="mt-1 text-[10px] leading-relaxed text-ink-muted">
          原：{change.before.startDate === change.before.endDate
            ? change.before.startDate
            : `${change.before.startDate} ~ ${change.before.endDate}`}
          {change.before.title !== title ? ` · ${change.before.title}` : ""}
        </p>
      )}

      <div className="mt-1 grid grid-cols-2 gap-1">
        <label className="flex items-center gap-1 text-[10px] text-ink-muted">
          开始
          <input
            type="date"
            value={startDate}
            onChange={(e) => onEdit({ startDate: e.target.value })}
            disabled={skipped}
            className={`${inputCls} px-1.5 py-0.5 disabled:opacity-60`}
          />
        </label>
        <label className="flex items-center gap-1 text-[10px] text-ink-muted">
          结束
          <input
            type="date"
            value={endDate}
            onChange={(e) => onEdit({ endDate: e.target.value })}
            disabled={skipped}
            className={`${inputCls} px-1.5 py-0.5 disabled:opacity-60`}
          />
        </label>
      </div>

      {change.reason && <p className="mt-1 text-[10px] leading-relaxed text-ink-muted">AI 理由：{change.reason}</p>}
    </div>
  );
}
