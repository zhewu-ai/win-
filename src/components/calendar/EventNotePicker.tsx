"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Note } from "@/types";

interface Props {
  /** 当前已关联的 noteId；null 表示未关联。 */
  value: string | null;
  onChange: (noteId: string | null) => void;
  /** 编辑已有事件时，关联便签的标题回填（新建时为 null）。 */
  noteTitle?: string | null;
}

// 事件编辑弹窗里的便签选择器：按标题/正文搜索，选中的便签以芯片显示。
// 单独实例，不依赖首页便签列表；搜索失败静默降级为空结果。

export default function EventNotePicker({ value, onChange, noteTitle }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Note[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Note | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  // 父级回填当前关联便签（编辑已有事件）。
  // 用函数式 setState：handlePick 已 setSelected(n) 且清空 results，
  // value 变化触发的这次 effect 不能再用空 results 把选中项覆盖成占位。
  useEffect(() => {
    setSelected((prev) => {
      if (!value) return null;
      if (prev && prev.id === value) return prev;
      const cached = results.find((n) => n.id === value);
      if (cached) return cached;
      // 编辑已有事件且未搜索时 results 为空，用父级回填的标题兜底
      return { id: value, title: noteTitle ?? "", content: "" } as Note;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const search = useCallback((q: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!q.trim()) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/notes?archived=false&q=${encodeURIComponent(q.trim())}`);
        const data = await res.json();
        // 便签列表接口成功返回 { notes: [...] }，无 ok 字段；与 useNotes 消费方式保持一致
        if (!res.ok || !Array.isArray(data.notes)) {
          setResults([]);
        } else {
          setResults(data.notes as Note[]);
        }
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const handlePick = (n: Note) => {
    setSelected(n);
    setQuery("");
    setOpen(false);
    setResults([]);
    onChange(n.id);
  };

  const handleClear = () => {
    setSelected(null);
    onChange(null);
  };

  return (
    <div ref={boxRef} className="relative">
      <label className="block text-xs font-medium text-ink-muted mb-1">关联便签</label>
      {selected ? (
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-input bg-surface-hover border border-border-light">
          <svg className="w-4 h-4 flex-shrink-0 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="flex-1 min-w-0 text-sm text-ink truncate">
            {selected.title || "未命名便签"}
          </span>
          <button
            type="button"
            onClick={handleClear}
            className="flex-shrink-0 p-0.5 text-ink-muted hover:text-danger rounded transition-colors"
            title="取消关联"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ) : (
        <div>
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
              search(e.target.value);
            }}
            onFocus={() => setOpen(true)}
            placeholder="搜索便签标题或正文..."
            className="w-full px-2.5 py-1.5 text-sm text-ink bg-panel-bg border border-border-light rounded-input outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15 transition-all placeholder:text-ink-muted"
          />
          {open && query.trim() && (
            <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-card bg-panel-bg border border-border-light shadow-lg">
              {searching && (
                <div className="px-3 py-2 text-xs text-ink-muted">搜索中...</div>
              )}
              {!searching && results.length === 0 && (
                <div className="px-3 py-2 text-xs text-ink-muted">没有匹配的便签</div>
              )}
              {results.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handlePick(n)}
                  className="w-full text-left px-3 py-2 text-sm text-ink hover:bg-surface-hover transition-colors truncate"
                >
                  {n.title || "未命名便签"}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
