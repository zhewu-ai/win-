"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import type { ChecklistItem, ChecklistGroup } from "@/types";
import { parseTodoLine } from "@/lib/note-serializer";

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function newItem(groupId: string): ChecklistItem {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    text: "",
    checked: false,
    sortOrder: Date.now(),
    createdAt: now,
    updatedAt: now,
    groupId,
  };
}

interface Props {
  items: ChecklistItem[];
  groups: ChecklistGroup[];
  onChange: (items: ChecklistItem[], groups: ChecklistGroup[]) => void;
}

export default function ChecklistEditor({ items, groups, onChange }: Props) {
  const itemInputRefs = useRef<Map<string, HTMLInputElement | null>>(new Map());
  const groupTitleRefs = useRef<Map<string, HTMLInputElement | null>>(new Map());
  const rootRef = useRef<HTMLDivElement>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);

  // Fallback default group when the parent has not persisted groups yet
  const safeGroups = useMemo(() => {
    if (groups.length > 0) return groups;
    return [
      { id: "default", title: "待办", sortOrder: 0, collapsedCompleted: true },
    ];
  }, [groups]);

  const sortedGroups = useMemo(
    () => [...safeGroups].sort((a, b) => a.sortOrder - b.sortOrder),
    [safeGroups]
  );

  const groupIncomplete = useCallback(
    (gid: string) =>
      items
        .filter((i) => i.groupId === gid && !i.checked)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [items]
  );

  const groupCompleted = useCallback(
    (gid: string) =>
      items
        .filter((i) => i.groupId === gid && i.checked)
        .sort((a, b) =>
          (b.completedAt || "").localeCompare(a.completedAt || "")
        ),
    [items]
  );

  const setItemRef = useCallback(
    (id: string, el: HTMLInputElement | null) => {
      if (el) itemInputRefs.current.set(id, el);
      else itemInputRefs.current.delete(id);
    },
    []
  );

  const setGroupTitleRef = useCallback(
    (id: string, el: HTMLInputElement | null) => {
      if (el) groupTitleRefs.current.set(id, el);
      else groupTitleRefs.current.delete(id);
    },
    []
  );

  const focusItem = useCallback((id: string) => {
    requestAnimationFrame(() => {
      const el = itemInputRefs.current.get(id);
      if (el) el.focus();
    });
  }, []);

  const updateItem = useCallback(
    (id: string, updates: Partial<ChecklistItem>) => {
      const now = new Date().toISOString();
      const newItems = items.map((item) =>
        item.id === id ? { ...item, ...updates, updatedAt: now } : item
      );
      onChange(newItems, safeGroups);
    },
    [items, safeGroups, onChange]
  );

  const updateGroups = useCallback(
    (nextGroups: ChecklistGroup[]) => onChange(items, nextGroups),
    [items, onChange]
  );

  const handleToggle = useCallback(
    (id: string) => {
      const item = items.find((i) => i.id === id);
      if (!item || !item.groupId) return;
      if (item.checked) {
        const incomplete = groupIncomplete(item.groupId);
        const maxSort = incomplete.reduce(
          (m, i) => Math.max(m, i.sortOrder),
          0
        );
        updateItem(id, {
          checked: false,
          completedAt: null,
          sortOrder: maxSort + 1,
        });
      } else {
        updateItem(id, { checked: true, completedAt: new Date().toISOString() });
      }
    },
    [items, groupIncomplete, updateItem]
  );

  const handleTextChange = useCallback(
    (id: string, text: string) => updateItem(id, { text }),
    [updateItem]
  );

  const handleItemDelete = useCallback(
    (id: string) => {
      const next = items.filter((i) => i.id !== id);
      onChange(
        next.length === 0 ? [newItem(safeGroups[0].id)] : next,
        safeGroups
      );
    },
    [items, safeGroups, onChange]
  );

  const addItemToGroup = useCallback(
    (gid: string, afterId?: string) => {
      const incomplete = groupIncomplete(gid);
      let sortOrder: number;
      if (afterId) {
        const idx = incomplete.findIndex((i) => i.id === afterId);
        const anchor = incomplete[idx];
        const next = incomplete[idx + 1];
        sortOrder = next
          ? (anchor.sortOrder + next.sortOrder) / 2
          : anchor.sortOrder + 1;
      } else {
        const last = incomplete[incomplete.length - 1];
        sortOrder = last ? last.sortOrder + 1 : 0;
      }
      const item = newItem(gid);
      item.sortOrder = sortOrder;
      onChange([...items, item], safeGroups);
      focusItem(item.id);
    },
    [items, safeGroups, groupIncomplete, onChange, focusItem]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>, id: string) => {
      const item = items.find((i) => i.id === id);
      if (!item || !item.groupId) return;

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        // Completed item Enter -> new item in this group's incomplete section;
        // otherwise insert after the current item (empty rows are cleaned up on blur)
        addItemToGroup(item.groupId, item.checked ? undefined : id);
        return;
      }

      if (e.key === "Backspace" && item.text === "") {
        e.preventDefault();
        if (items.length <= 1) return;
        const next = items.filter((i) => i.id !== id);
        onChange(next, safeGroups);
        const incomplete = groupIncomplete(item.groupId);
        const idx = incomplete.findIndex((i) => i.id === id);
        const prevId = idx > 0 ? incomplete[idx - 1].id : undefined;
        if (prevId) focusItem(prevId);
        return;
      }

      // Arrow navigation within this group's incomplete list
      const incomplete = groupIncomplete(item.groupId);
      const idx = incomplete.findIndex((i) => i.id === id);
      if (e.key === "ArrowUp" && idx > 0) {
        e.preventDefault();
        const el = itemInputRefs.current.get(incomplete[idx - 1].id);
        if (el) {
          el.focus();
          el.setSelectionRange(el.value.length, el.value.length);
        }
        return;
      }
      if (e.key === "ArrowDown" && idx >= 0 && idx < incomplete.length - 1) {
        e.preventDefault();
        const el = itemInputRefs.current.get(incomplete[idx + 1].id);
        if (el) {
          el.focus();
          el.setSelectionRange(el.value.length, el.value.length);
        }
        return;
      }
    },
    [items, safeGroups, groupIncomplete, onChange, focusItem, addItemToGroup]
  );

  // Paste multi-line text -> split into multiple todos, clean prefixes, insert after current
  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>, id: string) => {
      const lines = e.clipboardData
        .getData("text")
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
      if (lines.length === 0) return;
      const parsedAll = lines.map(parseTodoLine);
      const parsedLines = parsedAll.filter((p) => p.text.length > 0);
      if (parsedLines.length === 0) return;

      // Single line without a numbering/bullet/checkbox marker: let default paste
      // happen (insert at cursor) instead of forcing a new item.
      const hasMarker = lines.some((l, i) => {
        const p = parsedAll[i];
        return p ? p.checked || p.text !== l : false;
      });
      if (lines.length === 1 && !hasMarker) return;

      e.preventDefault();

      const item = items.find((i) => i.id === id);
      if (!item || !item.groupId) return;
      const gid = item.groupId;
      const incomplete = groupIncomplete(gid);
      const idx = incomplete.findIndex((i) => i.id === id);
      const now = new Date().toISOString();

      let insertLines = parsedLines;
      let result = [...items];

      let anchorSort: number;
      let nextSort: number | undefined;
      if (idx >= 0) {
        anchorSort = incomplete[idx].sortOrder;
        nextSort =
          idx + 1 < incomplete.length
            ? incomplete[idx + 1].sortOrder
            : undefined;
        if (item.text.trim() === "") {
          // First line overwrites the empty current item
          const first = parsedLines[0];
          result = result.map((i) =>
            i.id === id
              ? {
                  ...i,
                  text: first.text,
                  checked: first.checked,
                  completedAt: first.checked ? now : null,
                  updatedAt: now,
                }
              : i
          );
          insertLines = parsedLines.slice(1);
        }
      } else {
        // Current item is completed -> append to end of group's incomplete list
        const last = incomplete[incomplete.length - 1];
        anchorSort = last ? last.sortOrder + 1 : 0;
        nextSort = undefined;
      }

      const n = insertLines.length;
      const step = nextSort !== undefined ? (nextSort - anchorSort) / (n + 1) : 1;
      const newItems: ChecklistItem[] = insertLines.map((p, i) => ({
        id: generateId(),
        text: p.text,
        checked: p.checked,
        sortOrder: anchorSort + step * (i + 1),
        createdAt: now,
        updatedAt: now,
        groupId: gid,
        completedAt: p.checked ? now : null,
      }));

      onChange(
        newItems.length > 0 ? [...result, ...newItems] : result,
        safeGroups
      );
      focusItem(
        newItems.length > 0 ? newItems[newItems.length - 1].id : id
      );
    },
    [items, safeGroups, groupIncomplete, onChange, focusItem]
  );

  // Container-level paste fallback: paste onto the checklist area background
  // (no input focused) appends cleaned lines to the default group's incomplete list.
  const handleContainerPaste = useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      const lines = e.clipboardData
        .getData("text")
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
      if (lines.length === 0) return;
      const parsedLines = lines
        .map(parseTodoLine)
        .filter((p) => p.text.length > 0);
      if (parsedLines.length === 0) return;
      e.preventDefault();

      const gid = safeGroups[0].id;
      const incomplete = groupIncomplete(gid);
      const last = incomplete[incomplete.length - 1];
      const baseSort = last ? last.sortOrder + 1 : 0;
      const now = new Date().toISOString();
      const newItems: ChecklistItem[] = parsedLines.map((p, i) => ({
        id: generateId(),
        text: p.text,
        checked: p.checked,
        sortOrder: baseSort + i,
        createdAt: now,
        updatedAt: now,
        groupId: gid,
        completedAt: p.checked ? now : null,
      }));
      onChange([...items, ...newItems], safeGroups);
      focusItem(newItems[newItems.length - 1].id);
    },
    [items, safeGroups, groupIncomplete, onChange, focusItem]
  );

  const handleBlur = useCallback(() => {
    const nonEmpty = items.filter((i) => i.text.trim() !== "");
    if (nonEmpty.length === 0) {
      if (items.length > 1) {
        onChange([items[0]], safeGroups);
      }
    } else if (nonEmpty.length !== items.length) {
      onChange(nonEmpty, safeGroups);
    }
  }, [items, safeGroups, onChange]);

  const handleGroupTitleChange = useCallback(
    (gid: string, title: string) => {
      updateGroups(
        safeGroups.map((g) => (g.id === gid ? { ...g, title } : g))
      );
    },
    [safeGroups, updateGroups]
  );

  const handleToggleCollapse = useCallback(
    (gid: string) => {
      updateGroups(
        safeGroups.map((g) =>
          g.id === gid
            ? { ...g, collapsedCompleted: !g.collapsedCompleted }
            : g
        )
      );
    },
    [safeGroups, updateGroups]
  );

  const renderItem = (item: ChecklistItem) => (
    <div key={item.id} className="flex items-start gap-3 group">
      <button
        onClick={() => handleToggle(item.id)}
        className={`flex-shrink-0 mt-[7px] w-[19px] h-[19px] rounded-full border-2 flex items-center justify-center transition-colors ${
          item.checked
            ? "bg-[#E3C24A] border-[#E3C24A] text-[#1A1A1A]"
            : "border-ink-muted/55 hover:border-ink-secondary"
        }`}
        title={item.checked ? "标记为未完成" : "标记为已完成"}
      >
        {item.checked && (
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>
      <input
        ref={(el) => setItemRef(item.id, el)}
        type="text"
        value={item.text}
        onChange={(e) => handleTextChange(item.id, e.target.value)}
        onFocus={() => setFocusedId(item.id)}
        onBlur={(e) => {
          setFocusedId(null);
          // Only trim empty rows when focus leaves the checklist entirely;
          // moving focus between rows (e.g. Enter just added a fresh empty row)
          // must keep the empty row so the user can keep typing.
          const next = e.relatedTarget as Node | null;
          if (next && rootRef.current && rootRef.current.contains(next)) return;
          handleBlur();
        }}
        onKeyDown={(e) => handleKeyDown(e, item.id)}
        onPaste={(e) => handlePaste(e, item.id)}
        placeholder={focusedId === item.id ? "" : "新待办..."}
        className={`flex-1 bg-transparent border-none outline-none py-0.5 text-edit-body placeholder:text-ink-muted/45 ${
          item.checked ? "text-ink-muted line-through" : "text-ink"
        }`}
      />
      <button
        onClick={() => handleItemDelete(item.id)}
        className="opacity-0 group-hover:opacity-100 transition-opacity mt-1 p-1 text-ink-muted hover:text-danger rounded-btn"
        title="删除此项"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );

  return (
    <div ref={rootRef} className="space-y-5" onPaste={handleContainerPaste}>
      {sortedGroups.map((g) => {
        const incomplete = groupIncomplete(g.id);
        const completed = groupCompleted(g.id);
        const isSingle = sortedGroups.length <= 1;
        return (
          <div key={g.id} className="group/gblock">
            {/* Group title - only shown when multiple groups exist */}
            {!isSingle && (
              <div className="flex items-center gap-2 mb-1">
                <input
                  ref={(el) => setGroupTitleRef(g.id, el)}
                  value={g.title}
                  onChange={(e) => handleGroupTitleChange(g.id, e.target.value)}
                  placeholder="分组"
                  className="flex-1 min-w-0 bg-transparent border-none outline-none text-edit-body font-semibold text-ink placeholder:text-ink-muted/40 py-0.5"
                />
              </div>
            )}

            {/* Incomplete items */}
            {incomplete.map((item) => renderItem(item))}

            {/* Add todo - weak entry */}
            <button
              onClick={() => addItemToGroup(g.id)}
              className="flex items-center gap-1.5 mt-1 py-1 px-1 text-list-meta text-ink-muted hover:text-primary transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              添加待办
            </button>

            {/* Completed section */}
            {completed.length > 0 && (
              <div className="mt-3">
                <button
                  onClick={() => handleToggleCollapse(g.id)}
                  className="flex items-center gap-1 text-list-meta text-ink-muted hover:text-ink transition-colors"
                  title={g.collapsedCompleted ? "展开已完成" : "收起已完成"}
                >
                  <svg
                    className={`w-3 h-3 transition-transform ${g.collapsedCompleted ? "-rotate-90" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                  已完成 {completed.length}
                </button>
                {!g.collapsedCompleted && (
                  <div className="mt-1.5 space-y-1.5">
                    {completed.map((item) => renderItem(item))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
