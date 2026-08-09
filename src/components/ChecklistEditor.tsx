"use client";

import { Fragment, useCallback, useMemo, useRef, useState } from "react";
import type { ChecklistItem, ChecklistGroup, Note } from "@/types";
import { parseChecklistLine } from "@/lib/note-serializer";
import LinkEditor from "./LinkEditor";
import type { Editor } from "@tiptap/react";

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function nowIso(): string {
  return new Date().toISOString();
}

interface Props {
  items: ChecklistItem[];
  groups: ChecklistGroup[];
  onChange: (items: ChecklistItem[], groups: ChecklistGroup[]) => void;
  /** `[[` 便签搜索与芯片打开的来源便签列表 / 打开回调（M11.1.2） */
  linkableNotes?: Note[];
  onOpenNote?: (noteId: string) => Promise<boolean> | boolean | void;
}

export default function ChecklistEditor({
  items,
  groups,
  onChange,
  linkableNotes,
  onOpenNote,
}: Props) {
  const itemInputRefs = useRef<Map<string, Editor | null>>(new Map());
  const rootRef = useRef<HTMLDivElement>(null);
  const [completedCollapsed, setCompletedCollapsed] = useState(true);
  const dragIdRef = useRef<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    id: string;
    before: boolean;
  } | null>(null);

  // Flat rows sorted globally; "active" = headings + unchecked todos (kept in
  // order), "completed" = checked todos (single bottom section).
  const sortedRows = useMemo(
    () => [...items].sort((a, b) => a.sortOrder - b.sortOrder),
    [items]
  );
  const active = useMemo(
    () => sortedRows.filter((r) => r.kind === "heading" || !r.checked),
    [sortedRows]
  );
  const completed = useMemo(
    () =>
      sortedRows
        .filter((r) => r.kind !== "heading" && r.checked)
        .sort((a, b) =>
          (b.completedAt || "").localeCompare(a.completedAt || "")
        ),
    [sortedRows]
  );

  /** Re-emits rows with contiguous sortOrders: active first, then completed. */
  const commit = useCallback(
    (nextActive: ChecklistItem[], nextCompleted: ChecklistItem[]) => {
      const next = [...nextActive, ...nextCompleted].map((r, i) => ({
        ...r,
        sortOrder: i,
      }));
      onChange(next, []);
    },
    [onChange]
  );

  const setItemRef = useCallback((id: string, el: Editor | null) => {
    if (el) itemInputRefs.current.set(id, el);
    else itemInputRefs.current.delete(id);
  }, []);

  // 新建行时 LinkEditor 的 editorRef 在被动 effect 中注册，可能晚于首帧；
  // 用重试确保拿到实例后聚焦（最多 3 帧）。
  const focusRow = useCallback((id: string) => {
    const tryFocus = (attempt: number) => {
      const ed = itemInputRefs.current.get(id);
      if (ed) {
        ed.commands.focus();
        return;
      }
      if (attempt < 3) requestAnimationFrame(() => tryFocus(attempt + 1));
    };
    requestAnimationFrame(() => tryFocus(1));
  }, []);

  const updateText = useCallback(
    (id: string, text: string) => {
      const now = nowIso();
      onChange(
        items.map((r) => (r.id === id ? { ...r, text, updatedAt: now } : r)),
        []
      );
    },
    [items, onChange]
  );

  const handleToggle = useCallback(
    (id: string) => {
      const item = items.find((i) => i.id === id);
      if (!item || item.kind === "heading") return;
      const now = nowIso();
      if (item.checked) {
        commit(
          [...active, { ...item, checked: false, completedAt: null }],
          completed.filter((r) => r.id !== id)
        );
      } else {
        commit(
          active.filter((r) => r.id !== id),
          [...completed, { ...item, checked: true, completedAt: now }]
        );
      }
    },
    [items, active, completed, commit]
  );

  const newTodo = useCallback(
    (text: string): ChecklistItem => ({
      id: generateId(),
      kind: "todo",
      text,
      checked: false,
      sortOrder: 0,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      completedAt: null,
    }),
    []
  );

  const newHeading = useCallback(
    (text: string): ChecklistItem => ({
      id: generateId(),
      kind: "heading",
      text,
      checked: false,
      sortOrder: 0,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      completedAt: null,
    }),
    []
  );

  const addTodoAfter = useCallback(
    (id: string) => {
      const idx = active.findIndex((r) => r.id === id);
      const item = newTodo("");
      const nextActive =
        idx < 0
          ? [...active, item]
          : [...active.slice(0, idx + 1), item, ...active.slice(idx + 1)];
      commit(nextActive, completed);
      focusRow(item.id);
    },
    [active, completed, commit, newTodo, focusRow]
  );

  const addTodoAtEnd = useCallback(() => {
    const item = newTodo("");
    commit([...active, item], completed);
    focusRow(item.id);
  }, [active, completed, commit, newTodo, focusRow]);

  const insertHeadingAt = useCallback(
    (activeIndex: number) => {
      const item = newHeading("");
      const nextActive = [
        ...active.slice(0, activeIndex),
        item,
        ...active.slice(activeIndex),
      ];
      commit(nextActive, completed);
      focusRow(item.id);
    },
    [active, completed, commit, newHeading, focusRow]
  );

  const addHeadingAtEnd = useCallback(() => {
    const item = newHeading("");
    commit([...active, item], completed);
    focusRow(item.id);
  }, [active, completed, commit, newHeading, focusRow]);

  const deleteItem = useCallback(
    (id: string) => {
      const nextActive = active.filter((r) => r.id !== id);
      const nextCompleted = completed.filter((r) => r.id !== id);
      if (nextActive.length === 0 && nextCompleted.length === 0) {
        commit([newTodo("")], []);
        return;
      }
      commit(nextActive, nextCompleted);
    },
    [active, completed, commit, newTodo]
  );

  // 行级键处理：Enter 加新待办、空行 Backspace 删行、Arrow 上下移焦。
  // 返回 true 表示已消费（LinkEditor 不再处理该键）。editor 参数取自 LinkEditor 实例。
  const handleRowKeyDown = useCallback(
    (e: KeyboardEvent, _editor: Editor, id: string): boolean => {
      const item = items.find((i) => i.id === id);
      if (!item) return false;

      if (e.key === "Enter") {
        e.preventDefault();
        if (!e.shiftKey) addTodoAfter(id);
        return true;
      }

      if (e.key === "Backspace" && item.text === "") {
        e.preventDefault();
        if (items.length <= 1) return true;
        const idx = active.findIndex((r) => r.id === id);
        const prevId = idx > 0 ? active[idx - 1].id : undefined;
        deleteItem(id);
        if (prevId) focusRow(prevId);
        return true;
      }

      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        const idx = active.findIndex((r) => r.id === id);
        if (e.key === "ArrowUp" && idx > 0) {
          e.preventDefault();
          focusRow(active[idx - 1].id);
          return true;
        }
        if (e.key === "ArrowDown" && idx >= 0 && idx < active.length - 1) {
          e.preventDefault();
          focusRow(active[idx + 1].id);
          return true;
        }
      }
      return false;
    },
    [items, active, addTodoAfter, deleteItem, focusRow]
  );

  const makeRow = useCallback(
    (p: { kind: "todo" | "heading"; text: string; checked: boolean }) => {
      const now = nowIso();
      const checked = p.kind === "todo" && p.checked;
      return {
        id: generateId(),
        kind: p.kind,
        text: p.text,
        checked,
        sortOrder: 0,
        createdAt: now,
        updatedAt: now,
        completedAt: checked ? now : null,
      } as ChecklistItem;
    },
    []
  );

  // 行内粘贴（LinkEditor singleLine 模式下把剪贴板按行拆分传入）：
  // 多行或含标记 → 拆成多行待办/小标题；单行纯文本 → 返回 false 交给 LinkEditor 原样插入。
  const handleRowPaste = useCallback(
    (lines: string[], id: string): boolean => {
      const clean = lines.map((l) => l.trim()).filter((l) => l.length > 0);
      if (clean.length === 0) return false;
      const parsedAll = clean.map(parseChecklistLine);
      const parsedLines = parsedAll.filter((p) => p.text.length > 0);
      if (parsedLines.length === 0) return false;

      // Single plain line without markers/heading: let default paste insert text.
      const hasMarker = clean.some((l, i) => {
        const p = parsedAll[i];
        return p.kind === "heading" || p.checked || p.text !== l;
      });
      if (clean.length === 1 && !hasMarker) return false;

      const now = nowIso();
      const idx = active.findIndex((r) => r.id === id);
      let nextActive = [...active];
      let pasted = parsedLines.map((p) => makeRow(p));

      if (idx >= 0 && active[idx].text.trim() === "" && pasted.length > 0) {
        const first = pasted[0];
        if (first.kind !== "heading") {
          nextActive[idx] = {
            ...nextActive[idx],
            text: first.text,
            checked: false,
            completedAt: null,
            updatedAt: now,
          };
          pasted = pasted.slice(1);
        }
      }

      const activeInsert = pasted.filter(
        (r) => r.kind === "heading" || !r.checked
      );
      const completedInsert = pasted.filter(
        (r) => r.kind === "todo" && r.checked
      );
      const insertAt = idx + 1;
      nextActive.splice(insertAt, 0, ...activeInsert);
      commit(nextActive, [...completed, ...completedInsert]);
      if (activeInsert.length > 0) {
        focusRow(nextActive[insertAt + activeInsert.length - 1].id);
      }
      return true;
    },
    [active, completed, commit, makeRow, focusRow]
  );

  // 容器空白处粘贴（未落入任何编辑器）：PM 已在编辑器内消费过的粘贴会 preventDefault，
  // 这里据此跳过，避免重复插入。
  const handleContainerPaste = useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>) => {
      if (e.defaultPrevented) return;
      const lines = e.clipboardData
        .getData("text")
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
      if (lines.length === 0) return;
      const parsedLines = lines
        .map(parseChecklistLine)
        .filter((p) => p.text.length > 0);
      if (parsedLines.length === 0) return;
      e.preventDefault();

      const rows = parsedLines.map((p) => makeRow(p));
      const activeInsert = rows.filter((r) => r.kind === "heading" || !r.checked);
      const completedInsert = rows.filter(
        (r) => r.kind === "todo" && r.checked
      );
      commit([...active, ...activeInsert], [...completed, ...completedInsert]);
      if (activeInsert.length > 0) {
        focusRow(activeInsert[activeInsert.length - 1].id);
      }
    },
    [active, completed, commit, makeRow, focusRow]
  );

  const handleBlur = useCallback(() => {
    const nonEmpty = items.filter(
      (i) => i.kind === "heading" || i.text.trim() !== ""
    );
    if (nonEmpty.length === 0) {
      if (items.length > 1) onChange([newTodo("")], []);
    } else if (nonEmpty.length !== items.length) {
      const remainingIds = new Set(nonEmpty.map((i) => i.id));
      const nextActive = active.filter((r) => remainingIds.has(r.id));
      const nextCompleted = completed.filter((r) => remainingIds.has(r.id));
      commit(nextActive, nextCompleted);
    }
  }, [items, active, completed, commit, newTodo, onChange]);

  // --- Pointer-event drag & drop (active rows only) ---
  // HTML5 DnD (draggable + dragstart/drop) is unreliable inside WebView2
  // (Windows shell), so use pointer capture + elementFromPoint instead; this
  // works with both mouse and touch across browser / Tauri.
  const pointerDragRef = useRef<{ id: string } | null>(null);

  const handleHandlePointerDown = useCallback(
    (e: React.PointerEvent, id: string) => {
      if (e.button !== 0) return;
      pointerDragRef.current = { id };
      dragIdRef.current = id;
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    []
  );

  const handleHandlePointerMove = useCallback((e: React.PointerEvent) => {
    const drag = pointerDragRef.current;
    if (!drag) return;
    e.preventDefault();
    const under = document.elementFromPoint(e.clientX, e.clientY);
    const rowEl = under?.closest?.("[data-row-id]") as HTMLElement | null;
    const rowId = rowEl?.dataset.rowId;
    if (!rowId) return;
    if (rowId === drag.id) {
      setDropTarget((d) => (d && d.id === drag.id ? null : d));
      return;
    }
    const rect = rowEl.getBoundingClientRect();
    setDropTarget({
      id: rowId,
      before: e.clientY < rect.top + rect.height / 2,
    });
  }, []);

  const handleHandlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      const drag = pointerDragRef.current;
      if (!drag) return;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* capture may already be released */
      }
      const target = dropTarget;
      pointerDragRef.current = null;
      dragIdRef.current = null;
      setDropTarget(null);
      if (!target || target.id === drag.id) return;
      const from = active.findIndex((r) => r.id === drag.id);
      if (from < 0) return;
      const list = [...active];
      const [moved] = list.splice(from, 1);
      let to = list.findIndex((r) => r.id === target.id);
      if (to < 0) to = list.length;
      if (!target.before) to += 1;
      list.splice(Math.max(0, to), 0, moved);
      commit(list, completed);
    },
    [active, completed, commit, dropTarget]
  );

  const handleHandlePointerCancel = useCallback(() => {
    pointerDragRef.current = null;
    dragIdRef.current = null;
    setDropTarget(null);
  }, []);

  const insertDivider = (atIndex: number, key: string) => (
    <div key={key} className="relative group/ins h-1">
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-transparent group-hover/ins:bg-primary/40 transition-colors" />
      <button
        onClick={() => insertHeadingAt(atIndex)}
        title="在此插入小标题"
        className="absolute left-1 top-1/2 -translate-y-1/2 flex items-center justify-center w-[18px] h-[18px] rounded-full border border-border-light bg-panel-bg text-ink-muted opacity-0 group-hover/ins:opacity-100 hover:text-primary hover:border-primary/40 transition-all"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>
  );

  const dragHandle = (row: ChecklistItem) => (
    <div
      onPointerDown={(e) => handleHandlePointerDown(e, row.id)}
      onPointerMove={handleHandlePointerMove}
      onPointerUp={handleHandlePointerUp}
      onPointerCancel={handleHandlePointerCancel}
      className="flex-shrink-0 mt-0.5 -ml-1 w-6 h-6 flex items-center justify-center text-ink-muted/30 hover:text-ink-muted/70 cursor-grab active:cursor-grabbing touch-none select-none"
      title="拖动排序"
    >
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="9" cy="5" r="1.5" />
        <circle cx="15" cy="5" r="1.5" />
        <circle cx="9" cy="12" r="1.5" />
        <circle cx="15" cy="12" r="1.5" />
        <circle cx="9" cy="19" r="1.5" />
        <circle cx="15" cy="19" r="1.5" />
      </svg>
    </div>
  );

  const deleteButton = (row: ChecklistItem) => (
    <button
      onClick={() => deleteItem(row.id)}
      className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity mt-1 p-1 text-ink-muted hover:text-danger rounded-btn"
      title="删除"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  );

  const dropIndicator = (row: ChecklistItem) => (
    <>
      {dropTarget?.id === row.id && dropTarget.before && (
        <div className="absolute -top-[3px] left-0 right-0 h-[3px] rounded-full bg-primary" />
      )}
      {dropTarget?.id === row.id && !dropTarget.before && (
        <div className="absolute -bottom-[3px] left-0 right-0 h-[3px] rounded-full bg-primary" />
      )}
    </>
  );

  const renderTodoRow = (row: ChecklistItem, draggable: boolean) => (
    <div
      key={row.id}
      data-row-id={row.id}
      className="relative flex items-start gap-2.5 group"
    >
      {dropIndicator(row)}
      {draggable && dragHandle(row)}
      <button
        onClick={() => handleToggle(row.id)}
        className={`flex-shrink-0 mt-0.5 w-[19px] h-[19px] rounded-full border-2 flex items-center justify-center transition-colors ${
          row.checked
            ? "bg-primary border-primary text-white"
            : "border-ink-muted/55 hover:border-ink-secondary"
        }`}
        title={row.checked ? "标记为未完成" : "标记为已完成"}
      >
        {row.checked && (
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>
      <LinkEditor
        value={row.text}
        onChange={(v) => updateText(row.id, v)}
        onBlur={(e) => {
          const next = e.relatedTarget as Node | null;
          if (next && rootRef.current && rootRef.current.contains(next)) return;
          handleBlur();
        }}
        onKeyDown={(e, ed) => handleRowKeyDown(e, ed, row.id)}
        onPasteLines={(lines) => handleRowPaste(lines, row.id)}
        editorRef={(el) => setItemRef(row.id, el)}
        linkableNotes={linkableNotes || []}
        onOpenNote={onOpenNote}
        placeholder="新待办..."
        hidePlaceholderOnFocus
        singleLine
        className="flex-1 min-w-0 w-0"
        contentClassName="min-h-[20px] text-edit-body leading-[1.5]"
      />
      {deleteButton(row)}
    </div>
  );

  const renderHeadingRow = (row: ChecklistItem) => (
    <div
      key={row.id}
      data-row-id={row.id}
      className="relative flex items-center gap-2.5 group"
    >
      {dropIndicator(row)}
      {dragHandle(row)}
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <div className="flex-1 h-px bg-ink-muted/15" />
        <LinkEditor
          value={row.text}
          onChange={(v) => updateText(row.id, v)}
          onBlur={(e) => {
            const next = e.relatedTarget as Node | null;
            if (next && rootRef.current && rootRef.current.contains(next)) return;
            handleBlur();
          }}
          onKeyDown={(e, ed) => handleRowKeyDown(e, ed, row.id)}
          onPasteLines={(lines) => handleRowPaste(lines, row.id)}
          editorRef={(el) => setItemRef(row.id, el)}
          linkableNotes={linkableNotes || []}
          onOpenNote={onOpenNote}
          placeholder="小标题"
          hidePlaceholderOnFocus
          singleLine
          className="flex-[1.5] min-w-0 w-0"
          contentClassName="min-h-[18px] text-center text-xs font-semibold tracking-wide text-ink-muted/85"
          dataPhOpacity="0.3"
        />
        <div className="flex-1 h-px bg-ink-muted/15" />
      </div>
      {deleteButton(row)}
    </div>
  );

  return (
    <div ref={rootRef} onPaste={handleContainerPaste}>
      {active.map((row, idx) => (
        <Fragment key={row.id}>
          {insertDivider(idx, `div-${idx}-top`)}
          {row.kind === "heading"
            ? renderHeadingRow(row)
            : renderTodoRow(row, true)}
        </Fragment>
      ))}
      {insertDivider(active.length, "div-end")}

      {/* Add actions */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={addTodoAtEnd}
          className="flex items-center gap-1.5 py-1 px-1 text-list-meta text-ink-muted hover:text-primary transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          添加待办
        </button>
        <button
          onClick={addHeadingAtEnd}
          className="flex items-center gap-1.5 py-1 px-1 text-list-meta text-ink-muted hover:text-primary transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          添加小标题
        </button>
      </div>

      {/* Unified completed section */}
      {completed.length > 0 && (
        <div className="mt-2 pt-2 border-t border-border-light/60">
          <button
            onClick={() => setCompletedCollapsed((v) => !v)}
            className="flex items-center gap-1 text-list-meta text-ink-muted hover:text-ink transition-colors"
            title={completedCollapsed ? "展开已完成" : "收起已完成"}
          >
            <svg
              className={`w-3 h-3 transition-transform ${
                completedCollapsed ? "-rotate-90" : ""
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
            已完成 {completed.length}
          </button>
          {!completedCollapsed && (
            <div className="mt-1 space-y-1">
              {completed.map((row) => renderTodoRow(row, false))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
