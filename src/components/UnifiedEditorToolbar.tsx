"use client";

import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";

interface Props {
  editor: Editor | null;
  onInsertTodo: () => void;
  onInsertLink: () => void;
}

function TBtn({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={`flex items-center justify-center w-8 h-8 shrink-0 rounded-btn transition-colors ${
        active
          ? "text-primary bg-surface-strong"
          : "text-ink-muted hover:text-ink hover:bg-surface-hover"
      } disabled:opacity-40 disabled:pointer-events-none`}
    >
      {children}
    </button>
  );
}

/** P1 轻量格式工具栏：加粗/斜体/标题/引用/分割线 + 待办/内链，作用于统一编辑器选区。 */
export default function UnifiedEditorToolbar({ editor, onInsertTodo, onInsertLink }: Props) {
  // 选区/事务变化时重渲染以刷新 active 态
  const [, force] = useState(0);
  useEffect(() => {
    if (!editor) return;
    const refresh = () => force((n) => n + 1);
    editor.on("selectionUpdate", refresh);
    editor.on("transaction", refresh);
    return () => {
      editor.off("selectionUpdate", refresh);
      editor.off("transaction", refresh);
    };
  }, [editor]);

  const bold = () => editor?.chain().focus().toggleMark("bold").run();
  const italic = () => editor?.chain().focus().toggleMark("italic").run();
  const heading = () => editor?.chain().focus().toggleNode("heading", "noteText", { level: 2 }).run();
  const quote = () => editor?.chain().focus().toggleNode("quote", "noteText").run();
  const divider = () => editor?.chain().focus().setDivider().run();

  return (
    <div className="flex items-center gap-0.5 px-3 py-1.5 border-b border-border-light bg-toolbar-bg overflow-x-auto">
      <TBtn onClick={bold} active={editor?.isActive("bold")} disabled={!editor} title="加粗">
        <span className="text-sm font-bold leading-none">B</span>
      </TBtn>
      <TBtn onClick={italic} active={editor?.isActive("italic")} disabled={!editor} title="斜体">
        <span className="text-sm italic leading-none">I</span>
      </TBtn>
      <TBtn onClick={heading} active={editor?.isActive("heading")} disabled={!editor} title="标题">
        <span className="text-sm font-semibold leading-none">Aa</span>
      </TBtn>
      <TBtn onClick={quote} active={editor?.isActive("quote")} disabled={!editor} title="引用">
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M6.5 11c-.3 0-.6 0-.9.1.3-1.8 1.6-3 3.4-3.5a.5.5 0 00-.2-1A5.5 5.5 0 004.2 13 3 3 0 107.5 17 3.6 3.6 0 006.5 11zm9 0c-.3 0-.6 0-.9.1.3-1.8 1.6-3 3.4-3.5a.5.5 0 00-.2-1 5.5 5.5 0 00-4.6 5.4A3 3 0 1015.5 17a3.6 3.6 0 000-6z" />
        </svg>
      </TBtn>
      <TBtn onClick={divider} disabled={!editor} title="分割线">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
        </svg>
      </TBtn>

      <div className="w-px h-4 bg-border-light mx-1 shrink-0" />

      <TBtn onClick={onInsertTodo} disabled={!editor} title="插入待办清单">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      </TBtn>
      <TBtn onClick={onInsertLink} title="插入便签链接">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
        </svg>
      </TBtn>
    </div>
  );
}
