"use client";

import { useState } from "react";
import type { Note } from "@/types";
import NoteList from "./NoteList";
import AccountMenu from "./AccountMenu";

interface Props {
  notes: Note[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onBulkDelete: (ids: string[]) => Promise<void>;
  loading?: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onCreateNote: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  onCollapse?: () => void;
  /** M12 管理员灰度：true 时列表顶部展示「日历」分组入口卡片。 */
  isAdmin?: boolean;
  /** M12 R2：日历入口卡片回调（右面板嵌入展示，不跳独立页） */
  onOpenCalendar?: () => void;
  calendarActive?: boolean;
  /** M12 返修：工作日历筛选状态，同步左侧预览卡 */
  calendarHiddenProjectIds?: Set<string>;
  calendarShowNoteLayer?: boolean;
}

export default function Sidebar({
  notes,
  selectedId,
  onSelect,
  onBulkDelete,
  loading,
  searchQuery,
  onSearchChange,
  onCreateNote,
  onRefresh,
  onCollapse,
  isAdmin,
  onOpenCalendar,
  calendarActive,
  calendarHiddenProjectIds,
  calendarShowNoteLayer,
}: Props) {
  // M12 体验细修：多选状态由 NoteList 上报，据此隐藏搜索框（2.11）
  const [listSelectionMode, setListSelectionMode] = useState(false);

  return (
    <div className="flex flex-col h-full min-h-0 bg-sidebar-bg">
      {/* Search：多选时隐藏（2.11）；刷新入口已移入「三个点」菜单（2.10） */}
      {!listSelectionMode && (
        <div className="flex items-center gap-1.5 px-3 pt-3 pb-2 flex-shrink-0">
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
              className="w-full pl-9 pr-8 py-2 text-sm text-ink bg-search-bg rounded-input border border-border-light/60 outline-none focus:bg-panel-bg focus:border-primary/40 focus:ring-2 focus:ring-primary/15 transition-all placeholder:text-ink-muted"
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
              className="flex items-center justify-center w-icon-btn h-icon-btn flex-shrink-0 text-ink-muted hover:text-ink hover:bg-surface-hover rounded-btn transition-colors"
              title="收起侧边栏"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Note list（含 M12 日历分组入口卡片，仅管理员） */}
      <div className="flex-1 min-h-0 flex flex-col">
        <NoteList
          notes={notes}
          selectedId={selectedId}
          onSelect={onSelect}
          onBulkDelete={onBulkDelete}
          loading={loading}
          searchQuery={searchQuery}
          isAdmin={isAdmin}
          onOpenCalendar={onOpenCalendar}
          calendarActive={calendarActive}
          calendarHiddenProjectIds={calendarHiddenProjectIds}
          calendarShowNoteLayer={calendarShowNoteLayer}
          selectionMode={listSelectionMode}
          onSelectionModeChange={setListSelectionMode}
          onRefresh={onRefresh}
        />
      </div>

      {/* Bottom global footer: 新建 + account */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-border-light flex-shrink-0 bg-sidebar-bg">
        <button
          onClick={onCreateNote}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-medium text-ink-muted hover:text-ink hover:bg-surface-hover rounded-btn transition-colors whitespace-nowrap"
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
