"use client";

import { useEffect, useState } from "react";
import type { Note } from "@/types";
import { formatNoteTime } from "@/lib/format-time";
import { useSyncStatus } from "@/hooks/useSyncStatus";
import ConfirmDialog from "./ConfirmDialog";

interface Props {
  notes: Note[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onBulkDelete: (ids: string[]) => Promise<void>;
  loading?: boolean;
  searchQuery?: string;
}

const ACCENT: Record<string, string> = {
  yellow: "bg-accent-yellow",
  blue: "bg-accent-blue",
  green: "bg-accent-green",
  pink: "bg-accent-pink",
  gray: "bg-accent-gray",
};

function getAutoTitle(note: Note): string {
  if (note.title) return note.title;
  if (note.mode === "text") {
    const firstLine = note.content.split("\n")[0]?.trim();
    if (firstLine) return firstLine;
  }
  if (note.mode === "checklist" && note.checklistItems?.length > 0) {
    const firstItem = note.checklistItems.find(
      (i) => i.kind !== "heading" && i.text.trim().length > 0
    );
    if (firstItem) return firstItem.text;
  }
  return "无标题便签";
}

function getSummaryLines(note: Note): string[] {
  if (note.mode === "checklist" && note.checklistItems?.length > 0) {
    return note.checklistItems
      .filter((i) => i.text.trim().length > 0)
      .slice(0, 3)
      .map((i) =>
        i.kind === "heading"
          ? i.text
          : `${i.checked ? "✓" : "○"} ${i.text}`
      );
  }
  if (note.mode === "text" && note.content) {
    const lines = note.content
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .slice(0, 2);
    return lines;
  }
  return [];
}

function getTodoProgress(note: Note): { done: number; total: number } | null {
  if (note.mode !== "checklist" || !note.checklistItems?.length) return null;
  const nonEmpty = note.checklistItems.filter(
    (i) => i.kind !== "heading" && i.text.trim().length > 0
  );
  if (nonEmpty.length === 0) return null;
  return {
    done: nonEmpty.filter((i) => i.checked).length,
    total: nonEmpty.length,
  };
}

function getDateSection(dateStr: string): { label: string; rank: number } {
  const date = new Date(dateStr);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfNoteDay = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );
  const diffDays = Math.floor(
    (startOfToday.getTime() - startOfNoteDay.getTime()) / 86400000
  );

  if (diffDays <= 0) return { label: "今天", rank: 0 };
  if (diffDays <= 7) return { label: "过去 7 天", rank: 1 };
  if (diffDays <= 30) return { label: "过去 30 天", rank: 2 };
  return {
    label: date.toLocaleDateString("zh-CN", {
      month: "long",
    }),
    rank: 3 + diffDays,
  };
}

// Highlight matching text segments
function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query || !text) return <>{text}</>;
  const lower = text.toLowerCase();
  const qLower = query.toLowerCase();
  const parts: { match: boolean; text: string }[] = [];
  let lastIndex = 0;

  let idx = lower.indexOf(qLower, lastIndex);
  while (idx !== -1) {
    if (idx > lastIndex) {
      parts.push({ match: false, text: text.slice(lastIndex, idx) });
    }
    parts.push({ match: true, text: text.slice(idx, idx + query.length) });
    lastIndex = idx + query.length;
    idx = lower.indexOf(qLower, lastIndex);
  }
  if (lastIndex < text.length) {
    parts.push({ match: false, text: text.slice(lastIndex) });
  }

  return (
    <>
      {parts.map((p, i) =>
        p.match ? (
          <mark key={i} className="bg-selection-yellow/25 rounded-sm px-0.5 text-inherit">
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        )
      )}
    </>
  );
}

function SectionHeader({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 px-5 pt-5 pb-2 first:pt-4">
      <svg
        className="hidden w-3.5 h-3.5 text-ink-muted"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.75}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
      </svg>
      <span className="text-[17px] leading-tight font-bold text-ink-muted">
        {label}
      </span>
    </div>
  );
}

export default function NoteList({
  notes,
  selectedId,
  onSelect,
  onBulkDelete,
  loading,
  searchQuery,
}: Props) {
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedSet, setSelectedSet] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { isOnline } = useSyncStatus();

  // 列表变化时剔除已消失的选中项（外部删除/搜索过滤后残留）
  useEffect(() => {
    setSelectedSet((prev) => {
      const ids = new Set(notes.map((n) => n.id));
      const next = new Set([...prev].filter((id) => ids.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [notes]);

  // 没有便签时退出多选模式
  useEffect(() => {
    if (notes.length === 0) {
      setSelectionMode(false);
      setSelectedSet(new Set());
      setConfirmOpen(false);
    }
  }, [notes.length]);

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin [scrollbar-gutter:stable]">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-20 rounded-card bg-surface-hover animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (notes.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-center">
        <div>
          <svg
            className="w-10 h-10 text-ink-muted/45 mx-auto mb-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            />
          </svg>
          <p className="text-ink-muted text-[15px] font-semibold">
            {searchQuery
              ? "未找到匹配的便签"
              : "还没有便签，点击上方「新建」开始"}
          </p>
        </div>
      </div>
    );
  }

  const pinned = notes.filter((n) => n.isPinned);
  const regular = notes.filter((n) => !n.isPinned);
  const regularGroups = regular.reduce<
    Array<{ label: string; rank: number; notes: Note[] }>
  >((groups, note) => {
    const { label, rank } = getDateSection(note.updatedAt);
    const group = groups.find((g) => g.label === label);
    if (group) {
      group.notes.push(note);
    } else {
      groups.push({ label, rank, notes: [note] });
    }
    return groups;
  }, []);
  // Deterministic ordering: 今天 first, then older buckets; newest within each section.
  regularGroups.sort((a, b) => a.rank - b.rank);
  regularGroups.forEach((g) =>
    g.notes.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
  );

  const visibleIds = notes.map((n) => n.id);
  const allSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedSet.has(id));

  const toggleSelectAll = () => {
    setSelectedSet((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        visibleIds.forEach((id) => next.delete(id));
      } else {
        visibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const confirmBulkDelete = async () => {
    const ids = Array.from(selectedSet);
    if (ids.length === 0) return;
    setDeleting(true);
    try {
      await onBulkDelete(ids);
      setSelectedSet(new Set());
      setSelectionMode(false);
      setConfirmOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  function NoteItem({ note }: { note: Note }) {
    const accent = ACCENT[note.color] || "bg-accent-gray";
    const selectedCls = ACCENT[note.color]
      ? `card-selected card-selected-${note.color}`
      : "card-selected card-selected-gray";
    const isSelected = selectedId === note.id;
    const dotCls = isSelected
      ? "card-color-dot card-color-dot-selected"
      : "card-color-dot";
    const autoTitle = getAutoTitle(note);
    const summaryLines = getSummaryLines(note);
    const progress = getTodoProgress(note);
    const isChecked = selectionMode && selectedSet.has(note.id);

    const handleItemClick = () => {
      if (selectionMode) {
        setSelectedSet((prev) => {
          const next = new Set(prev);
          if (next.has(note.id)) next.delete(note.id);
          else next.add(note.id);
          return next;
        });
      } else {
        onSelect(note.id);
      }
    };

    return (
      <button
        onClick={handleItemClick}
        data-note-id={note.id}
        className={`relative w-full text-left rounded-card ${
          isSelected ? selectedCls : "card-surface"
        }`}
      >
        <div className={`px-5 py-4 ${selectionMode ? "flex items-start gap-2" : ""}`}>
          {selectionMode && (
            <span
              className={`mt-0.5 flex-shrink-0 w-[18px] h-[18px] rounded-full border flex items-center justify-center transition-colors ${
                isChecked
                  ? "bg-primary border-primary text-white"
                  : "border-border-strong"
              }`}
              aria-hidden="true"
            >
              {isChecked && (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </span>
          )}
          <div className="flex-1 min-w-0">
            {/* Title row */}
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p
                  className={`text-[17px] leading-[1.18] font-bold truncate ${
                    isSelected ? "text-white" : "text-ink"
                  }`}
                >
                  <HighlightText text={autoTitle} query={searchQuery || ""} />
                </p>
              </div>
              <span className={`${dotCls} ${accent} mt-0.5`} aria-hidden="true" />
            </div>

            {/* Summary lines */}
            {summaryLines.length > 0 && (
              <div className="mt-1.5 space-y-0.5">
                {summaryLines.map((line, i) => (
                  <p
                    key={i}
                    className={`text-[15px] leading-[1.28] font-semibold truncate ${
                      isSelected ? "text-white/[0.82]" : "text-ink-secondary"
                    }`}
                  >
                    <HighlightText text={line} query={searchQuery || ""} />
                  </p>
                ))}
              </div>
            )}

            {/* Meta row: 待办进度在左，最后修改日期在右 */}
            <div className="flex items-center justify-between gap-3 mt-2">
              <div className="flex items-center gap-3">
                {progress && (
                  <span
                    className={`text-[13px] leading-tight font-semibold ${
                      isSelected ? "text-white/[0.72]" : "text-ink-muted"
                    }`}
                  >
                    {progress.done}/{progress.total}
                  </span>
                )}
              </div>
              <span
                className={`text-[13px] leading-tight font-semibold ${
                  isSelected ? "text-white/[0.72]" : "text-ink-muted"
                }`}
              >
                {formatNoteTime(note.updatedAt)}
              </span>
            </div>
          </div>
        </div>
      </button>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-sidebar-bg">
      {selectionMode ? (
        <div className="flex items-center gap-1.5 px-3 pt-2 flex-shrink-0">
          <span className="text-xs font-medium text-ink-muted flex-shrink-0">
            已选 {selectedSet.size} 条
          </span>
          <button
            onClick={toggleSelectAll}
            className="text-xs font-medium text-ink-secondary hover:text-ink hover:bg-surface-hover rounded-btn px-1.5 py-1 transition-colors flex-shrink-0"
          >
            {allSelected ? "取消全选" : "全选"}
          </button>
          <div className="flex-1" />
          <button
            onClick={() => {
              setSelectionMode(false);
              setSelectedSet(new Set());
            }}
            className="text-xs font-medium text-ink-muted hover:text-ink hover:bg-surface-hover rounded-btn px-1.5 py-1 transition-colors flex-shrink-0"
          >
            取消
          </button>
          <button
            onClick={() => setConfirmOpen(true)}
            disabled={selectedSet.size === 0 || !isOnline || deleting}
            title={!isOnline ? "离线时暂不支持批量删除，请联网后再试。" : undefined}
            className="text-xs font-medium text-danger hover:bg-danger/10 rounded-btn px-2 py-1 transition-colors flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
          >
            删除
          </button>
        </div>
      ) : (
        <div className="flex justify-end px-3 pt-1.5 flex-shrink-0">
          <button
            onClick={() => {
              setSelectionMode(true);
              setSelectedSet(new Set());
            }}
            className="text-xs font-medium text-ink-muted hover:text-ink hover:bg-surface-hover rounded-btn px-1.5 py-1 transition-colors"
          >
            选择
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2.5 scrollbar-thin [scrollbar-gutter:stable]">
        {pinned.length > 0 && (
          <div>
            <SectionHeader
              label="置顶"
              icon="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
            />
            <div className="space-y-2.5">
              {pinned.map((note) => (
                <NoteItem key={note.id} note={note} />
              ))}
            </div>
          </div>
        )}
        {regularGroups.map((group) => (
          <div key={group.label}>
            {pinned.length > 0 && group === regularGroups[0] && (
              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center px-5">
                  <div className="w-full border-t border-border-light/80" />
                </div>
              </div>
            )}
            <SectionHeader
              label={group.label}
              icon="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
            <div className="space-y-2.5">
              {group.notes.map((note) => (
                <NoteItem key={note.id} note={note} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="批量删除"
        message={`确定将选中的 ${selectedSet.size} 条便签移入回收站？`}
        confirmLabel={deleting ? "删除中..." : "删除"}
        onConfirm={() => void confirmBulkDelete()}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
