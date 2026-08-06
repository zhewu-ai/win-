"use client";

import { useState, useRef, useEffect } from "react";
import type { NoteColor } from "@/types";

const COLORS: { value: NoteColor; bg: string }[] = [
  { value: "yellow", bg: "bg-accent-yellow" },
  { value: "blue", bg: "bg-accent-blue" },
  { value: "green", bg: "bg-accent-green" },
  { value: "pink", bg: "bg-accent-pink" },
  { value: "gray", bg: "bg-accent-gray" },
];

type ColorMode = "spacious" | "compact" | "minimal";

interface Props {
  selected: NoteColor;
  onChange: (color: NoteColor) => void;
  /** spacious=色球；compact=颜色按钮+弹层；minimal=不渲染（收进更多菜单） */
  mode?: ColorMode;
}

export default function ColorPicker({
  selected,
  onChange,
  mode = "compact",
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (mode === "minimal") return null;

  const selectedBg =
    COLORS.find((c) => c.value === selected)?.bg || "bg-accent-gray";

  const ballCls = (value: NoteColor) =>
    `w-5 h-5 ${COLORS.find((c) => c.value === value)?.bg} rounded-full transition-all ${
      selected === value
        ? "ring-2 ring-ring-selected ring-offset-2 ring-offset-toolbar-bg scale-110"
        : "hover:scale-110 opacity-85 hover:opacity-100"
    }`;

  return (
    <div className="relative flex items-center" ref={ref}>
      {mode === "spacious" ? (
        <div className="toolbar-item flex items-center gap-1.5">
          {COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => onChange(c.value)}
              className={ballCls(c.value)}
              title={c.value}
              aria-label={c.value}
            />
          ))}
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex items-center justify-center w-icon-btn h-icon-btn rounded-btn text-ink-muted hover:text-ink hover:bg-surface-hover transition-colors"
            title="选择颜色"
            aria-expanded={open}
          >
            <span className={`w-4 h-4 rounded-full ${selectedBg}`} />
          </button>
          {open && (
            <div className="absolute left-0 top-full mt-1.5 flex gap-2 px-2.5 py-2 bg-toolbar-bg border border-border-light rounded-card shadow-xl z-20 menu-pop">
              {COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => {
                    onChange(c.value);
                    setOpen(false);
                  }}
                  className={`w-5 h-5 ${c.bg} rounded-full transition-transform ${
                    selected === c.value
                      ? "ring-2 ring-ring-selected ring-offset-2 ring-offset-toolbar-bg scale-110"
                      : "hover:scale-110"
                  }`}
                  title={c.value}
                  aria-label={c.value}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
