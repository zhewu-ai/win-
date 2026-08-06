"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ConfirmDialog from "./ConfirmDialog";

type EditableTarget = HTMLInputElement | HTMLTextAreaElement;

type MenuAction = "copy" | "paste" | "cut" | "selectAll" | "delete";

interface TextMenuState {
  type: "text";
  x: number;
  y: number;
  editable: EditableTarget | null;
  contentEditable: HTMLElement | null;
  hasSelection: boolean;
}

interface NoteMenuState {
  type: "note";
  x: number;
  y: number;
  noteId: string;
}

type MenuState = TextMenuState | NoteMenuState;

const TEXT_MENU_ITEMS: { key: MenuAction; label: string; danger?: boolean }[] = [
  { key: "copy", label: "复制" },
  { key: "paste", label: "粘贴" },
  { key: "cut", label: "剪切" },
  { key: "selectAll", label: "全选" },
  { key: "delete", label: "删除所选", danger: true },
];

const NOTE_MENU_ITEMS = [{ key: "duplicate", label: "复制一份" }] as const;

function isFormEditable(el: HTMLElement | null): el is EditableTarget {
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA");
}

function insertIntoEditable(el: EditableTarget, text: string) {
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? start;
  el.setRangeText(text, start, end, "end");
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

function clampMenu(x: number, y: number, w: number, h: number) {
  return {
    x: Math.max(8, Math.min(x, window.innerWidth - w - 8)),
    y: Math.max(8, Math.min(y, window.innerHeight - h - 8)),
  };
}

/** Dispatch after a note is duplicated/deleted so list pages can refresh. */
export function emitNotesChanged(deletedId?: string) {
  window.dispatchEvent(
    new CustomEvent("sticky-notes:changed", { detail: { deletedId } })
  );
}

export default function ContextMenuProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setMenu(null), []);

  useEffect(() => {
    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      const target = e.target as HTMLElement;

      // Note card → note-level menu
      const noteEl = target.closest<HTMLElement>("[data-note-id]");
      const noteId = noteEl?.getAttribute("data-note-id");
      if (noteId) {
        const pos = clampMenu(e.clientX, e.clientY, 176, 2 * 34 + 8);
        setMenu({ type: "note", noteId, ...pos });
        return;
      }

      // Text menu only over editable elements
      const editable = target.closest(
        "input, textarea, [contenteditable='true']"
      ) as EditableTarget | HTMLElement | null;
      if (!editable) {
        close();
        return;
      }

      let hasSelection = false;
      if (isFormEditable(editable)) {
        hasSelection =
          editable.selectionStart !== null &&
          editable.selectionEnd !== null &&
          editable.selectionEnd > editable.selectionStart;
      } else {
        const sel = window.getSelection();
        hasSelection = !!sel && !sel.isCollapsed;
      }

      const pos = clampMenu(e.clientX, e.clientY, 176, 5 * 34 + 8);
      setMenu({
        type: "text",
        ...pos,
        editable: isFormEditable(editable) ? editable : null,
        contentEditable:
          editable && !isFormEditable(editable)
            ? (editable as HTMLElement)
            : null,
        hasSelection,
      });
    };

    const onMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        close();
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onScroll = () => close();

    document.addEventListener("contextmenu", onContextMenu, true);
    document.addEventListener("mousedown", onMouseDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("contextmenu", onContextMenu, true);
      document.removeEventListener("mousedown", onMouseDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", close);
    };
  }, [close]);

  const runTextAction = useCallback(
    async (action: MenuAction) => {
      if (!menu || menu.type !== "text") return;
      const { editable, contentEditable, hasSelection } = menu;
      const formEl = editable;
      const ceEl = contentEditable;

      switch (action) {
        case "copy": {
          document.execCommand("copy");
          break;
        }
        case "cut": {
          if (formEl && hasSelection) document.execCommand("cut");
          break;
        }
        case "paste": {
          let text: string | null = null;
          try {
            text = await navigator.clipboard.readText();
          } catch {
            try {
              document.execCommand("paste");
              return;
            } catch {
              text = null;
            }
          }
          if (text === null) return;
          if (formEl) {
            insertIntoEditable(formEl, text);
          } else if (ceEl) {
            document.execCommand("insertText", false, text);
          }
          break;
        }
        case "selectAll": {
          if (formEl) formEl.select();
          else if (ceEl) document.execCommand("selectAll");
          else document.execCommand("selectAll");
          break;
        }
        case "delete": {
          if (formEl && hasSelection) document.execCommand("delete");
          else if (ceEl && hasSelection) document.execCommand("delete");
          break;
        }
      }
      close();
    },
    [menu, close]
  );

  const duplicateNote = useCallback(async () => {
    if (!menu || menu.type !== "note") return;
    const noteId = menu.noteId;
    close();
    try {
      const res = await fetch(`/api/notes/${noteId}/duplicate`, {
        method: "POST",
      });
      if (!res.ok) throw new Error();
      emitNotesChanged();
    } catch {
      alert("复制便签失败");
    }
  }, [menu, close]);

  const requestDeleteNote = useCallback(() => {
    if (!menu || menu.type !== "note") return;
    setConfirmDeleteId(menu.noteId);
    close();
  }, [menu, close]);

  const confirmDeleteNote = useCallback(async () => {
    if (!confirmDeleteId) return;
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    try {
      const res = await fetch(`/api/notes/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      emitNotesChanged(id);
    } catch {
      alert("删除便签失败");
    }
  }, [confirmDeleteId]);

  const menuHasSelection = menu?.type === "text" ? menu.hasSelection : false;

  return (
    <>
      {children}
      {menu &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-[9999] min-w-[176px] rounded-card border border-border-light bg-toolbar-bg shadow-lg shadow-black/40 py-1 select-none"
            style={{ left: menu.x, top: menu.y }}
          >
            {menu.type === "text"
              ? TEXT_MENU_ITEMS.map((item) => {
                  const needsSelection = item.key === "cut" || item.key === "delete";
                  const disabled = needsSelection && !menuHasSelection;
                  return (
                    <div key={item.key}>
                      {item.key === "delete" && (
                        <div className="mx-2 my-0.5 h-px bg-border-light/60" />
                      )}
                      <button
                        onClick={() => runTextAction(item.key)}
                        disabled={disabled}
                        className={`w-full text-left px-3 py-[7px] text-[13px] transition-colors ${
                          disabled
                            ? "text-ink-muted/40 cursor-default"
                            : item.danger
                            ? "text-danger hover:bg-danger/10"
                            : "text-ink hover:bg-surface-hover"
                        }`}
                      >
                        {item.label}
                      </button>
                    </div>
                  );
                })
              : (
                  <>
                    {NOTE_MENU_ITEMS.map((item) => (
                      <button
                        key={item.key}
                        onClick={duplicateNote}
                        className="w-full text-left px-3 py-[7px] text-[13px] text-ink hover:bg-surface-hover transition-colors"
                      >
                        {item.label}
                      </button>
                    ))}
                    <div className="mx-2 my-0.5 h-px bg-border-light/60" />
                    <button
                      onClick={requestDeleteNote}
                      className="w-full text-left px-3 py-[7px] text-[13px] text-danger hover:bg-danger/10 transition-colors"
                    >
                      删除便签
                    </button>
                  </>
                )}
          </div>,
          document.body
        )}
      <ConfirmDialog
        open={!!confirmDeleteId}
        title="删除便签"
        message="确定删除此便签？删除后可在回收站恢复。"
        confirmLabel="删除"
        onConfirm={confirmDeleteNote}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </>
  );
}
