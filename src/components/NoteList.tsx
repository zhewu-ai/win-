"use client";

import type { Note } from "@/types";

interface Props {
  notes: Note[];
  selectedId: string | null;
  onSelect: (id: string) => void;
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

const SELECTED: Record<string, string> = {
  yellow: "bg-sel-yellow",
  blue: "bg-sel-blue",
  green: "bg-sel-green",
  pink: "bg-sel-pink",
  gray: "bg-sel-gray",
};

const TINT: Record<string, string> = {
  yellow: "hover:bg-tint-yellow active:bg-tint-yellow",
  blue: "hover:bg-tint-blue active:bg-tint-blue",
  green: "hover:bg-tint-green active:bg-tint-green",
  pink: "hover:bg-tint-pink active:bg-tint-pink",
  gray: "hover:bg-tint-gray active:bg-tint-gray",
};

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);

  if (mins < 1) return "刚刚";
  if (mins < 60) return `${mins}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 7) return `${days}天前`;
  return date.toLocaleDateString("zh-CN");
}

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

function getImageCount(note: Note): number {
  return note.attachments?.length || 0;
}

function getDateSection(dateStr: string): string {
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

  if (diffDays <= 0) return "今天";
  if (diffDays <= 7) return "过去 7 天";
  if (diffDays <= 30) return "过去 30 天";
  return date.toLocaleDateString("zh-CN", {
    month: "long",
  });
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
          <mark key={i} className="bg-amber-200/70 rounded-sm px-0.5 text-inherit">
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
  loading,
  searchQuery,
}: Props) {
  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-20 rounded-card bg-black/[0.04] animate-pulse"
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
  const regularGroups = regular.reduce<Array<{ label: string; notes: Note[] }>>(
    (groups, note) => {
      const label = getDateSection(note.updatedAt);
      const group = groups.find((g) => g.label === label);
      if (group) {
        group.notes.push(note);
      } else {
        groups.push({ label, notes: [note] });
      }
      return groups;
    },
    []
  );

  function NoteItem({ note }: { note: Note }) {
    const accent = ACCENT[note.color] || "bg-accent-gray";
    const selected = SELECTED[note.color] || "bg-sel-gray";
    const tint = TINT[note.color] || "hover:bg-tint-gray active:bg-tint-gray";
    const autoTitle = getAutoTitle(note);
    const summaryLines = getSummaryLines(note);
    const progress = getTodoProgress(note);
    const imageCount = getImageCount(note);
    const isSelected = selectedId === note.id;
    const thumbnail = note.attachments?.[0];

    return (
      <button
        onClick={() => onSelect(note.id)}
        className={`relative w-full text-left rounded-[8px] transition-colors duration-150 ${
          isSelected ? `${selected} text-white` : tint
        }`}
      >
        <span
          className={`absolute left-0 top-3 bottom-3 w-[3px] rounded-full ${
            isSelected ? "bg-white/35" : accent
          }`}
        />
        <div className="pl-6 pr-5 py-4">
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
            {thumbnail && (
              <img
                src={thumbnail.url}
                alt={thumbnail.filename}
                className="w-[54px] h-[54px] rounded-[4px] object-cover flex-shrink-0 ring-1 ring-white/10"
              />
            )}
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

          {/* Meta row */}
          <div className="flex items-center gap-3 mt-2">
            <span
              className={`text-[13px] leading-tight font-semibold ${
                isSelected ? "text-white/[0.72]" : "text-ink-muted"
              }`}
            >
              {formatTime(note.updatedAt)}
            </span>
            {imageCount > 0 && (
              <span
                className={`text-[13px] leading-tight font-semibold ${
                  isSelected ? "text-white/[0.72]" : "text-ink-muted"
                }`}
              >
                {imageCount} 图
              </span>
            )}
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
        </div>
      </button>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-3 py-1 space-y-1 scrollbar-thin bg-sidebar-bg">
      {pinned.length > 0 && (
        <div>
          <SectionHeader
            label="置顶"
            icon="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
          />
          <div className="space-y-0.5">
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
          <div className="space-y-0.5">
            {group.notes.map((note) => (
              <NoteItem key={note.id} note={note} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
