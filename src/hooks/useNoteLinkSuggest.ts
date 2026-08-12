"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import type { Note } from "@/types";
import type { CaretCoords } from "@/components/InlineNoteLinkSuggest";

const MAX_LINK_SUGGEST = 8;
const LINK_SUGGEST_RE = /\[\[([^\]\n]*)$/;

/**
 * `[[` 便签搜索浮层逻辑，LinkEditor（单块/待办行）与 NoteDocumentEditor（统一文档段落）共用。
 * 提供浮层状态、过滤结果、键盘接管与插入；渲染由调用方负责 `<InlineNoteLinkSuggest/>`。
 * 注意：editorRef 必须在 useEditor 之前创建并传入（编辑器 options 需要引用 detectSuggest 等）。
 */
export function useNoteLinkSuggest({
  editorRef,
  linkableNotes,
}: {
  editorRef: React.MutableRefObject<Editor | null>;
  linkableNotes: Note[];
}) {
  const [suggest, setSuggest] = useState<{
    start: number;
    query: string;
    anchor: CaretCoords;
  } | null>(null);
  const [suggestIndex, setSuggestIndex] = useState(0);
  const suggestRef = useRef(suggest);
  suggestRef.current = suggest;
  const suggestIndexRef = useRef(suggestIndex);
  suggestIndexRef.current = suggestIndex;
  const lastQueryRef = useRef<string | null>(null);

  const suggestResults = useMemo(() => {
    if (!suggest) return [];
    const kw = suggest.query.trim().toLowerCase();
    const pool = linkableNotes.filter((n) => !n.isArchived);
    if (!kw) return pool.slice(0, MAX_LINK_SUGGEST);
    return pool
      .filter(
        (n) =>
          n.title.toLowerCase().includes(kw) ||
          (n.mode !== "checklist" && n.content.toLowerCase().includes(kw))
      )
      .slice(0, MAX_LINK_SUGGEST);
  }, [suggest, linkableNotes]);
  const suggestResultsRef = useRef<Note[]>([]);
  suggestResultsRef.current = suggestResults;

  const closeSuggest = useCallback(() => {
    lastQueryRef.current = null;
    setSuggest(null);
  }, []);
  const closeSuggestRef = useRef(closeSuggest);
  closeSuggestRef.current = closeSuggest;

  // `[[` 探测：光标前文本以 "[[query" 结尾时弹便签搜索浮层（跳过手写 note: 前缀）
  const detectSuggest = useCallback(() => {
    const ed = editorRef.current;
    if (!ed) return;
    const { state } = ed;
    const $pos = state.selection.$from;
    if ($pos.parent.type.name !== "noteText") {
      closeSuggestRef.current();
      return;
    }
    const before = $pos.parent.textBetween(0, $pos.parentOffset, "\n", "\n");
    const m = before.match(LINK_SUGGEST_RE);
    if (m && !m[1].startsWith("note:")) {
      const rect = ed.view.coordsAtPos($pos.pos);
      if (lastQueryRef.current !== m[1]) {
        lastQueryRef.current = m[1];
        setSuggestIndex(0);
      }
      setSuggest({
        start: $pos.pos - m[0].length,
        query: m[1],
        anchor: {
          top: rect.top,
          left: rect.left,
          height: rect.bottom - rect.top,
        },
      });
    } else if (suggestRef.current) {
      closeSuggestRef.current();
    }
  }, []);

  const acceptSelect = useCallback((note: Note) => {
    const ed = editorRef.current;
    if (!ed) return;
    const start = suggestRef.current?.start ?? ed.state.selection.$from.pos;
    const end = ed.state.selection.$from.pos;
    closeSuggestRef.current();
    ed.chain()
      .focus()
      .insertContentAt(
        { from: start, to: end },
        {
          type: "noteLink",
          attrs: { id: note.id, title: note.title || "未命名便签" },
        }
      )
      .run();
  }, []);

  // 浮层打开时接管键盘；返回 true 表示已消费（不再走行级/默认键处理）
  const handleSuggestKeyDown = useCallback((event: KeyboardEvent): boolean => {
    if (!suggestRef.current) return false;
    const count = suggestResultsRef.current.length;
    if (event.key === "Escape") {
      event.preventDefault();
      closeSuggestRef.current();
      return true;
    }
    if (event.key === "ArrowDown" && count > 0) {
      event.preventDefault();
      setSuggestIndex((i) => Math.min(i + 1, count - 1));
      return true;
    }
    if (event.key === "ArrowUp" && count > 0) {
      event.preventDefault();
      setSuggestIndex((i) => Math.max(i - 1, 0));
      return true;
    }
    if (event.key === "Enter" && count > 0) {
      event.preventDefault();
      const target = suggestResultsRef.current[suggestIndexRef.current];
      if (target) acceptSelect(target);
      return true;
    }
    return false;
  }, [acceptSelect]);

  return {
    suggest,
    suggestResults,
    suggestIndex,
    setSuggestIndex,
    acceptSelect,
    closeSuggest,
    detectSuggest,
    handleSuggestKeyDown,
  };
}
