"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Note } from "@/types";

/** 光标锚点坐标（视口坐标系）：用于定位搜索浮层。 */
export interface CaretCoords {
  top: number;
  left: number;
  height: number;
}

interface Props {
  /** 已在父组件按关键词过滤好的结果 */
  results: Note[];
  anchor: CaretCoords;
  selectedIndex: number;
  onSelect: (note: Note) => void;
}

function excerpt(note: Note): string {
  const text =
    note.mode === "checklist"
      ? note.checklistItems.map((i) => i.text).join(" ")
      : note.content;
  const t = (text || "").replace(/\s+/g, " ").trim();
  return t.length > 60 ? t.slice(0, 60) + "…" : t;
}

const GAP = 6;
const MARGIN = 8;

export default function InlineNoteLinkSuggest({
  results,
  anchor,
  selectedIndex,
  onSelect,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  // 定位策略：默认在光标下方；越界翻到上方；水平 clamp 在视口内。
  // useLayoutEffect 在 paint 前按实际尺寸精修，避免首帧未 clamp 造成窄窗口越界。
  const [pos, setPos] = useState(() => ({
    left: Math.max(MARGIN, Math.min(anchor.left, window.innerWidth - 220 - MARGIN)),
    top: anchor.top + anchor.height + GAP,
  }));

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const left = Math.max(MARGIN, Math.min(anchor.left, window.innerWidth - width - MARGIN));
    let top = anchor.top + anchor.height + GAP;
    if (top + height > window.innerHeight - MARGIN) {
      top = anchor.top - height - GAP;
    }
    setPos({ left, top });
  }, [anchor, results]);

  return createPortal(
    <div
      ref={ref}
      className="fixed z-[9999] min-w-[220px] max-w-[min(320px,90vw)] max-h-[40vh] overflow-y-auto scrollbar-thin rounded-card border border-border-light bg-toolbar-bg shadow-lg shadow-black/40 py-1 select-none"
      style={{ left: pos.left, top: pos.top }}
      role="listbox"
      aria-label="选择便签链接"
    >
      {results.length === 0 ? (
        <div className="px-3 py-2 text-xs text-ink-muted/60">无匹配便签</div>
      ) : (
        results.map((n, i) => (
          <button
            key={n.id}
            type="button"
            role="option"
            aria-selected={i === selectedIndex}
            onClick={() => onSelect(n)}
            onMouseDown={(e) => e.preventDefault()}
            className={`w-full text-left px-3 py-2 transition-colors ${
              i === selectedIndex ? "bg-primary/10" : "hover:bg-surface-hover"
            }`}
          >
            <div className="text-sm text-ink font-medium truncate">
              {n.title || "未命名便签"}
            </div>
            {excerpt(n) && (
              <div className="mt-0.5 text-xs text-ink-muted/60 truncate">
                {excerpt(n)}
              </div>
            )}
          </button>
        ))
      )}
    </div>,
    document.body
  );
}
