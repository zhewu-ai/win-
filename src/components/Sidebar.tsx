"use client";

import type { Note } from "@/types";
import NoteList from "./NoteList";
import AccountMenu from "./AccountMenu";

interface Props {
  notes: Note[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  loading?: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onCreateNote: () => void;
  onCollapse?: () => void;
}

export default function Sidebar({
  notes,
  selectedId,
  onSelect,
  loading,
  searchQuery,
  onSearchChange,
  onCreateNote,
  onCollapse,
}: Props) {
  return (
    <div className="flex flex-col h-full min-h-0 bg-sidebar-bg">
      {/* Search */}
      <div className="flex items-center gap-1.5 px-3 pt-2.5 pb-2 flex-shrink-0">
        <div className="flex-1 relative min-w-0">
          <svg
            className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="搜索便签..."
            className="w-full pl-9 pr-8 py-1.5 text-sm text-ink bg-search-bg rounded-input border border-white/5 outline-none focus:bg-white/10 focus:border-white/10 focus:ring-1 focus:ring-white/10 transition-all placeholder:text-ink-muted"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-ink-muted hover:text-ink rounded transition-colors"
              title="清空搜索"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        {onCollapse && (
          <button
            onClick={onCollapse}
            className="hidden md:flex items-center justify-center w-icon-btn h-icon-btn flex-shrink-0 text-ink-muted hover:text-ink hover:bg-white/[0.08] rounded-btn transition-colors"
            title="收起侧边栏"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
      </div>

      {/* Note list */}
      <div className="flex-1 min-h-0 flex flex-col">
        <NoteList
          notes={notes}
          selectedId={selectedId}
          onSelect={onSelect}
          loading={loading}
          searchQuery={searchQuery}
        />
      </div>

      {/* Bottom global footer: 新建 + account */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-border-light flex-shrink-0 bg-sidebar-bg">
        <button
          onClick={onCreateNote}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-medium text-ink-muted hover:text-ink hover:bg-white/[0.08] rounded-btn transition-colors whitespace-nowrap"
          title="新建便签"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m-7-7h14" />
          </svg>
          新建
        </button>
        <div className="flex-1" />
        <AccountMenu dropdownPos="bottom-full mb-1.5" />
      </div>
    </div>
  );
}
