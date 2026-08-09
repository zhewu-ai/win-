"use client";

import type { CalendarImportDraft, CalendarImportUsage, CalendarImportYearNotice } from "@/types";
import { wpClass } from "./color";

// M13 AI 排期导入预览：展示识别出的草稿，支持编辑项目名/标题/起止日期、删除条目/项目、
// 确认导入/取消。AI 结果必须经用户确认后才入库。

interface Props {
  draft: CalendarImportDraft;
  usage?: CalendarImportUsage | null;
  yearNotice?: CalendarImportYearNotice | null;
  busy?: boolean;
  error?: string | null;
  onUpdateDraft: (draft: CalendarImportDraft) => void;
  onConfirm: () => void;
  onCancel: () => void;
  onDismissYearNotice?: () => void;
}

const inputCls =
  "w-full px-2 py-1 text-xs text-ink bg-panel-bg border border-border-light rounded-input outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15 transition-all";

export default function ImportPreviewPanel({
  draft,
  usage,
  yearNotice,
  busy,
  error,
  onUpdateDraft,
  onConfirm,
  onCancel,
  onDismissYearNotice,
}: Props) {
  const patchProject = (tempId: string, patch: Partial<{ name: string }>) => {
    onUpdateDraft({
      ...draft,
      projects: draft.projects.map((p) => (p.tempId === tempId ? { ...p, ...patch } : p)),
    });
  };

  const patchItem = (tempId: string, patch: Partial<{ title: string; startDate: string; endDate: string }>) => {
    onUpdateDraft({
      ...draft,
      items: draft.items.map((it) => (it.tempId === tempId ? { ...it, ...patch } : it)),
    });
  };

  const removeItem = (tempId: string) => {
    onUpdateDraft({ ...draft, items: draft.items.filter((it) => it.tempId !== tempId) });
  };

  const removeProject = (tempId: string) => {
    if (!window.confirm("删除该项目草稿及其中排期？")) return;
    onUpdateDraft({
      projects: draft.projects.filter((p) => p.tempId !== tempId),
      items: draft.items.filter((it) => it.projectTempId !== tempId),
      warnings: draft.warnings,
    });
  };

  // 2.2 批量改年份：把全部条目起止日期年份改为当前年
  const applyYearFix = () => {
    if (!yearNotice) return;
    const toYear = String(yearNotice.currentYear);
    onUpdateDraft({
      ...draft,
      items: draft.items.map((it) => ({
        ...it,
        startDate: `${toYear}${it.startDate.slice(4)}`,
        endDate: `${toYear}${it.endDate.slice(4)}`,
      })),
    });
    onDismissYearNotice?.();
  };

  const hasEmptyProjectName = draft.projects.some((p) => !p.name.trim());
  const confirmDisabled = busy || draft.items.length === 0 || hasEmptyProjectName;

  return (
    <div className="flex flex-col gap-3 px-3 pt-3">
      <div className="flex items-center justify-between">
        <h2 className="text-[13px] font-bold text-ink">导入预览</h2>
        {usage && (
          <span className="text-[10px] text-ink-muted">
            {usage.model.replace("Qwen/", "")} · {(usage.durationMs / 1000).toFixed(1)}s
          </span>
        )}
      </div>

      {yearNotice && (
        <div className="rounded-card bg-amber-500/10 px-3 py-2">
          <p className="text-xs font-semibold text-amber-600">
            检测到识别年份为 {yearNotice.detectedYear} 年，是否全部改为 {yearNotice.currentYear} 年？
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <button
              type="button"
              onClick={applyYearFix}
              className="rounded-btn bg-amber-500 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-amber-500/90"
            >
              全部改为 {yearNotice.currentYear}
            </button>
            <button
              type="button"
              onClick={() => onDismissYearNotice?.()}
              className="rounded-btn px-2 py-1 text-xs font-semibold text-ink-secondary transition-colors hover:bg-surface-hover"
            >
              忽略
            </button>
          </div>
        </div>
      )}

      {draft.warnings.length > 0 && (
        <div className="rounded-card bg-amber-500/10 px-3 py-2">
          <p className="text-xs font-semibold text-amber-600">识别提示</p>
          <ul className="mt-1 space-y-0.5 text-[11px] leading-relaxed text-ink-secondary">
            {draft.warnings.map((w, i) => (
              <li key={i}>· {w}</li>
            ))}
          </ul>
        </div>
      )}

      {draft.items.length === 0 && draft.projects.length === 0 && (
        <p className="rounded-card bg-surface-strong/50 px-3 py-4 text-center text-sm text-ink-muted">
          未识别到排期，请换更清晰的文件重试。
        </p>
      )}

      {draft.projects.map((p) => {
        const its = draft.items.filter((it) => it.projectTempId === p.tempId);
        return (
          <div key={p.tempId} className="rounded-card border border-border-light bg-panel-bg p-2">
            <div className="flex items-center gap-1.5">
              <span className={`h-3 w-3 flex-shrink-0 rounded-full wp-dot ${wpClass(p.colorKey)}`} />
              <input
                type="text"
                value={p.name}
                onChange={(e) => patchProject(p.tempId, { name: e.target.value })}
                maxLength={80}
                className="min-w-0 flex-1 bg-transparent text-[13px] font-semibold text-ink outline-none focus:bg-surface-hover/60 rounded-input px-1.5 py-0.5"
                aria-label="项目名"
              />
              <button
                type="button"
                onClick={() => removeProject(p.tempId)}
                className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-ink-muted transition-colors hover:bg-danger/10 hover:text-danger"
                title="删除项目草稿"
                aria-label={`删除项目 ${p.name}`}
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {!p.name.trim() && <p className="mt-1 text-[11px] font-semibold text-danger">请补充项目名</p>}

            {its.length === 0 ? (
              <p className="mt-1.5 text-[11px] text-ink-muted">该项目下暂无排期</p>
            ) : (
              <div className="mt-2 space-y-1.5">
                {its.map((it) => (
                  <div key={it.tempId} className="rounded-card bg-surface-strong/40 p-1.5">
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={it.title}
                        onChange={(e) => patchItem(it.tempId, { title: e.target.value })}
                        maxLength={120}
                        className="min-w-0 flex-1 bg-transparent text-xs font-medium text-ink outline-none focus:bg-surface-hover/60 rounded-input px-1.5 py-0.5"
                        aria-label="排期标题"
                      />
                      {it.confidence !== undefined && it.confidence < 0.7 && (
                        <span className="flex-shrink-0 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-600">
                          请确认
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => removeItem(it.tempId)}
                        className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-ink-muted transition-colors hover:bg-danger/10 hover:text-danger"
                        title="删除该条"
                        aria-label={`删除排期 ${it.title}`}
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <div className="mt-1 grid grid-cols-2 gap-1">
                      <label className="flex items-center gap-1 text-[10px] text-ink-muted">
                        开始
                        <input
                          type="date"
                          value={it.startDate}
                          onChange={(e) => patchItem(it.tempId, { startDate: e.target.value })}
                          className={`${inputCls} px-1.5 py-0.5`}
                        />
                      </label>
                      <label className="flex items-center gap-1 text-[10px] text-ink-muted">
                        结束
                        <input
                          type="date"
                          value={it.endDate}
                          onChange={(e) => patchItem(it.tempId, { endDate: e.target.value })}
                          className={`${inputCls} px-1.5 py-0.5`}
                        />
                      </label>
                    </div>
                    {it.note ? (
                      <p className="mt-1 truncate text-[10px] text-ink-muted">{it.note}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {error && <p className="text-xs text-danger">{error}</p>}
      {hasEmptyProjectName && !error && (
        <p className="text-xs text-amber-600">请先补充或删除空项目名后再导入。</p>
      )}

      <div className="flex items-center gap-2 pt-1">
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
          onClick={onConfirm}
          disabled={confirmDisabled}
          title={hasEmptyProjectName ? "请先补充项目名" : undefined}
          className="rounded-btn bg-primary px-3.5 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {busy ? "导入中..." : `确认导入（${draft.items.length}）`}
        </button>
      </div>
    </div>
  );
}
