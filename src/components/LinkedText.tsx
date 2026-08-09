"use client";

import { useMemo, useState } from "react";
import { parseNoteLinks } from "@/lib/link-parser";
import { isTauri, openExternal } from "@/lib/tauri";

interface Props {
  text: string;
  /** 点击内部链接时打开目标便签；返回 false 表示目标失效/无权限，链接变灰。 */
  onOpenNote?: (noteId: string) => Promise<boolean> | boolean | void;
  className?: string;
}

export default function LinkedText({ text, onOpenNote, className }: Props) {
  // 点击内部链接后解析失败的目标集合 → 渲染灰色「已失效」。不预校验，避免每条链接一次请求。
  const [failedIds, setFailedIds] = useState<Set<string>>(() => new Set());
  const segments = useMemo(() => parseNoteLinks(text), [text]);

  const handleExternalClick = (e: React.MouseEvent, href: string) => {
    // 渲染层外层 div 的 onClick 负责进入编辑态；点链接时应直接打开，不触发
    e.stopPropagation();
    if (!isTauri()) return; // 网页端走原生 <a target="_blank">
    e.preventDefault();
    void openExternal(href);
  };

  const handleInternalClick = async (e: React.MouseEvent, noteId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (failedIds.has(noteId) || !onOpenNote) return;
    const ok = await onOpenNote(noteId);
    if (ok === false) {
      setFailedIds((prev) => {
        const next = new Set(prev);
        next.add(noteId);
        return next;
      });
    }
  };

  return (
    <div className={className}>
      {segments.map((seg, i) => {
        if (seg.type === "text") {
          return <span key={i}>{seg.text}</span>;
        }
        if (seg.type === "url") {
          return (
            <a
              key={i}
              href={seg.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => handleExternalClick(e, seg.href)}
              className="text-primary underline decoration-primary/40 hover:decoration-primary underline-offset-2 break-all"
            >
              {seg.text}
            </a>
          );
        }
        const failed = failedIds.has(seg.noteId);
        return (
          <button
            key={i}
            type="button"
            disabled={failed}
            onClick={(e) => handleInternalClick(e, seg.noteId)}
            className={
              failed
                ? "inline-flex items-center gap-1 rounded-md bg-ink-muted/10 px-1.5 py-0.5 text-ink-muted/60 line-through decoration-ink-muted/40 cursor-not-allowed"
                : "inline-flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-primary hover:bg-primary/15 transition-colors"
            }
            title={failed ? "该便签已失效" : "打开便签"}
          >
            <svg
              className="w-3.5 h-3.5 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.75}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
              />
            </svg>
            <span className="align-middle">
              {failed ? `${seg.title}（已失效）` : seg.title}
            </span>
          </button>
        );
      })}
    </div>
  );
}
