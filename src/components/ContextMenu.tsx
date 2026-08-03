"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type EditableTarget = HTMLInputElement | HTMLTextAreaElement;

interface MenuState {
  x: number;
  y: number;
  editable: EditableTarget | null;
  contentEditable: HTMLElement | null;
  hasSelection: boolean;
}

type MenuAction = "copy" | "paste" | "cut" | "selectAll" | "delete";

interface MenuItem {
  key: MenuAction;
  label: string;
  danger?: boolean;
}

const MENU_ITEMS: MenuItem[] = [
  { key: "copy", label: "复制" },
  { key: "paste", label: "粘贴" },
  { key: "cut", label: "剪切" },
  { key: "selectAll", label: "全选" },
  { key: "delete", label: "删除所选", danger: true },
];

function isFormEditable(el: HTMLElement | null): el is EditableTarget {
  return (
    !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")
  );
}

function insertIntoEditable(el: EditableTarget, text: string) {
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? start;
  el.setRangeText(text, start, end, "end");
  // React controlled inputs listen to the native input event
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

export default function ContextMenuProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setMenu(null), []);

  useEffect(() => {
    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      const target = e.target as HTMLElement;
      const editable = target.closest(
        "input, textarea, [contenteditable='true']"
      ) as EditableTarget | HTMLElement | null;

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

      // Compute clamped position synchronously so the menu renders once,
      // at the final coordinates (avoids a one-frame render at the old spot).
      const menuW = 176;
      const menuH = MENU_ITEMS.length * 34 + 8;
      setMenu({
        x: Math.max(8, Math.min(e.clientX, window.innerWidth - menuW - 8)),
        y: Math.max(8, Math.min(e.clientY, window.innerHeight - menuH - 8)),
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

  const runAction = useCallback(
    async (action: MenuAction) => {
      if (!menu) return;
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

  return (
    <>
      {children}
      {menu &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-[9999] min-w-[176px] rounded-card border border-border-light bg-[#2A2527] shadow-lg shadow-black/40 py-1 select-none"
            style={{ left: menu.x, top: menu.y }}
          >
            {MENU_ITEMS.map((item) => (
              <div key={item.key}>
                {item.key === "delete" && (
                  <div className="mx-2 my-0.5 h-px bg-border-light/60" />
                )}
                <button
                  onClick={() => runAction(item.key)}
                  className={`w-full text-left px-3 py-[7px] text-[13px] transition-colors ${
                    item.danger
                      ? "text-danger hover:bg-danger/10"
                      : "text-ink hover:bg-white/[0.06]"
                  }`}
                >
                  {item.label}
                </button>
              </div>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}
