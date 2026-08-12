"use client";

import { useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import type { Note } from "@/types";
import {
  createNoteExtensions,
  parseNoteText,
  serializeNoteText,
} from "@/lib/note-text-schema";
import {
  setNodeViewContext,
  removeNodeViewContext,
} from "@/lib/node-view-context";
import { isTauri, openExternal } from "@/lib/tauri";
import InlineNoteLinkSuggest from "./InlineNoteLinkSuggest";
import { useNoteLinkSuggest } from "@/hooks/useNoteLinkSuggest";

interface Props {
  /** 存储用纯文本（内含 [[note:id|title]]） */
  value: string;
  onChange: (next: string) => void;
  linkableNotes: Note[];
  onOpenNote?: (noteId: string) => Promise<boolean> | boolean | void;
  /** 变化时重建编辑器（清空撤销栈）。正文传 note.id，切换便签时避免旧便签内容可被撤销。 */
  resetKey?: string;
  placeholder?: string;
  /** 聚焦时隐藏空态占位符（待办行用；正文始终显示） */
  hidePlaceholderOnFocus?: boolean;
  singleLine?: boolean;
  /** singleLine 下按 Enter 触发（行编辑器新增待办） */
  onEnter?: () => void;
  /** 行级键处理：返回 true 表示已消费（阻止 PM 默认行为） */
  onKeyDown?: (e: KeyboardEvent, editor: Editor) => boolean | void;
  /** 多行粘贴回调：返回 true 表示已处理（否则交给 PM 默认粘贴） */
  onPasteLines?: (lines: string[]) => boolean;
  /** 占位符透明度覆盖（小标题行更淡，经 data-ph-opacity 传给 CSS） */
  dataPhOpacity?: string;
  onFocus?: () => void;
  onBlur?: (e: React.FocusEvent<HTMLDivElement>) => void;
  editorRef?: (editor: Editor | null) => void;
  className?: string;
  /** 应用到编辑器宿主 div 的样式（如最小高度） */
  contentClassName?: string;
}

export default function LinkEditor({
  value,
  onChange,
  linkableNotes,
  onOpenNote,
  resetKey,
  placeholder = "",
  hidePlaceholderOnFocus = false,
  singleLine = false,
  onEnter,
  onKeyDown,
  onPasteLines,
  dataPhOpacity,
  onFocus,
  onBlur,
  editorRef,
  className,
  contentClassName,
}: Props) {
  // 全部动态回调走 ref：useEditor 只在挂载/ resetKey 变化时读取一次 options
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onEnterRef = useRef(onEnter);
  onEnterRef.current = onEnter;
  const onKeyDownRef = useRef(onKeyDown);
  onKeyDownRef.current = onKeyDown;
  const onPasteLinesRef = useRef(onPasteLines);
  onPasteLinesRef.current = onPasteLines;
  const onFocusRef = useRef(onFocus);
  onFocusRef.current = onFocus;
  const onBlurRef = useRef(onBlur);
  onBlurRef.current = onBlur;
  const onOpenNoteRef = useRef(onOpenNote);
  onOpenNoteRef.current = onOpenNote;
  const notesRef = useRef(linkableNotes);
  notesRef.current = linkableNotes;
  const singleLineRef = useRef(singleLine);
  singleLineRef.current = singleLine;
  const editorRefRef = useRef(editorRef);
  editorRefRef.current = editorRef;

  const lastSentRef = useRef<string>(value);
  const lastValueRef = useRef<string>(value);

  // 浮层状态/过滤/键盘接管抽到 useNoteLinkSuggest（与 NoteDocumentEditor 共用）。
  // 必须先用 hook 再建编辑器：useEditor 的 options 在创建时一次性读取回调，
  // hook 通过 editorRef（useEffect 填充）访问编辑器实例，避免先有鸡还是先有蛋。
  const instanceRef = useRef<Editor | null>(null);
  const {
    suggest,
    suggestResults,
    suggestIndex,
    acceptSelect,
    closeSuggest,
    detectSuggest,
    handleSuggestKeyDown,
  } = useNoteLinkSuggest({ editorRef: instanceRef, linkableNotes });

  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions: createNoteExtensions({ placeholder }),
      content: parseNoteText(value),
      onUpdate: ({ editor: ed }) => {
        const next = serializeNoteText(ed.state.doc);
        if (next === lastSentRef.current) return;
        lastSentRef.current = next;
        onChangeRef.current?.(next);
        detectSuggest();
      },
      onSelectionUpdate: () => detectSuggest(),
      editorProps: {
        handleKeyDown: (view, event) => {
          // 1. `[[` 浮层打开时优先接管键盘
          if (handleSuggestKeyDown(event)) return true;

          // 2. 行级自定义键处理（待办行的 Enter/Backspace/Arrow 导航）
          const custom = onKeyDownRef.current;
          if (custom) {
            const stop = custom(event, instanceRef.current!);
            if (stop) return true;
          }

          // 3. Enter：单行→外部回调；多行→插入 hardBreak（不做 splitBlock，保持单块 schema）
          if (
            event.key === "Enter" &&
            !event.shiftKey &&
            !event.metaKey &&
            !event.ctrlKey
          ) {
            event.preventDefault();
            if (singleLineRef.current) {
              onEnterRef.current?.();
              return true;
            }
            view.dispatch(
              view.state.tr
                .replaceSelectionWith(view.state.schema.nodes.hardBreak.create())
                .scrollIntoView()
            );
            return true;
          }
          return false;
        },
        handleClick: (view, pos, event) => {
          const target = event.target as HTMLElement | null;
          const link = target?.closest?.("a[href]");
          if (!link) return false;
          const href = link.getAttribute("href") || "";
          if (isTauri()) {
            event.preventDefault();
            void openExternal(href);
          }
          return true;
        },
        handlePaste: (view, event) => {
          const text = event.clipboardData?.getData("text") ?? "";
          if (!text) return false;
          if (singleLineRef.current) {
            const handled = onPasteLinesRef.current?.(text.split("\n")) ?? false;
            if (handled) return true;
            // 单行模式默认粘贴：去掉换行后按纯文本插入，避免 PM 把 \n 解析成 hardBreak（污染单行待办文本）
            const clean = text.replace(/\r\n/g, "").replace(/\r/g, "").replace(/\n/g, "");
            if (!clean) return false;
            const textNode = view.state.schema.text(clean);
            const { from, to } = view.state.selection;
            view.dispatch(view.state.tr.replaceWith(from, to, textNode).scrollIntoView());
            return true;
          }
          // 多行：按存储格式解析粘贴内容（[[note:...]] → 芯片，\n → hardBreak，URL → 纯文本）
          const inline = parseNoteText(text).content[0].content;
          if (inline.length === 0) return false;
          const frag = view.state.schema.nodeFromJSON({
            type: "noteText",
            content: inline,
          }).content;
          const { from, to } = view.state.selection;
          view.dispatch(view.state.tr.replaceWith(from, to, frag).scrollIntoView());
          return true;
        },
      },
    },
    [resetKey]
  );

  useEffect(() => {
    instanceRef.current = editor;
    editorRefRef.current?.(editor);
  }, [editor]);
  // resetKey 变化重建编辑器（切便签）时，清掉可能残留的搜索浮层，避免旧便签浮层悬挂
  useEffect(() => {
    closeSuggest();
  }, [editor]);
  useEffect(() => {
    return () => editorRefRef.current?.(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 把 onOpenNote 暴露给芯片 NodeView（按 editor 实例注册）
  useEffect(() => {
    if (!editor) return;
    setNodeViewContext(editor, {
      onOpenNote: onOpenNoteRef.current,
    });
  }, [editor, onOpenNote]);
  useEffect(() => {
    const ed = editor;
    return () => {
      if (ed) removeNodeViewContext(ed);
    };
  }, [editor]);

  // 外部 value 变化（切便签/远端更新/父组件重建行）：仅当文本真变化时替换 doc，不丢光标、不污染撤销栈
  useEffect(() => {
    if (!editor) return;
    if (value === lastValueRef.current) return;
    lastValueRef.current = value;
    lastSentRef.current = value;
    const current = serializeNoteText(editor.state.doc);
    // 自身输入经 onChange→父级 setContent 回环的 value 与 doc 相同，直接跳过；
    // 只有外部内容（切便签/远端更新/reset）真正替换 doc 时才关浮层。
    if (current === value) return;
    closeSuggest();
    const doc = editor.schema.nodeFromJSON(parseNoteText(value));
    editor.view.dispatch(
      editor.state.tr
        .replaceWith(0, editor.state.doc.content.size, doc)
        .setMeta("preventUpdate", true)
        .setMeta("addToHistory", false)
    );
  }, [editor, value]);

  const handleWrapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement;
    if (t.closest?.(".ProseMirror")) return;
    // 点击正文下方空白 → 光标移到末尾
    editor?.commands.focus("end");
  };

  return (
    <div
      className={className}
      data-hide-ph-on-focus={hidePlaceholderOnFocus ? "true" : undefined}
      data-ph-opacity={dataPhOpacity}
      onFocus={() => onFocusRef.current?.()}
      onBlur={(e) => {
        closeSuggest();
        onBlurRef.current?.(e);
      }}
      onClick={handleWrapClick}
    >
      <EditorContent editor={editor} className={contentClassName} />
      {suggest && (
        <InlineNoteLinkSuggest
          results={suggestResults}
          anchor={suggest.anchor}
          selectedIndex={suggestIndex}
          onSelect={acceptSelect}
        />
      )}
    </div>
  );
}
