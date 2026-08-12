"use client";

import { useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import { NodeSelection } from "@tiptap/pm/state";
import type { ChecklistGroup, ChecklistItem, Note } from "@/types";
import {
  createDocumentExtensions,
  parseNoteDocument,
  parseNoteText,
  docToNotePayload,
} from "@/lib/note-text-schema";
import {
  setNodeViewContext,
  removeNodeViewContext,
} from "@/lib/node-view-context";
import { isTauri, openExternal } from "@/lib/tauri";
import InlineNoteLinkSuggest from "./InlineNoteLinkSuggest";
import { useNoteLinkSuggest } from "@/hooks/useNoteLinkSuggest";

/** 统一文档一次保存的全部正文相关字段（NoteEditor 据此同步 state）。 */
export interface DocumentPayload {
  documentJson: string;
  content: string;
  checklistItems: ChecklistItem[];
  checklistGroups: ChecklistGroup[];
  mode: "text" | "checklist";
}

interface Props {
  /** 本地已同步的正文状态（受上层 localDirty 守卫控制，远端更新不会绕过）。
   *  documentJson 权威；为 null（旧数据）时按 mode/content/checklistItems 懒迁移推导初始文档。 */
  documentJson: string | null;
  mode: "text" | "checklist";
  content: string;
  checklistItems: ChecklistItem[];
  checklistGroups: ChecklistGroup[];
  /** 每次真实编辑输出完整载荷（未变更时不触发）。 */
  onChange: (payload: DocumentPayload) => void;
  /** `[[` 便签搜索与芯片打开来源（段落 + checklist 行共用）。 */
  linkableNotes: Note[];
  onOpenNote?: (noteId: string) => Promise<boolean> | boolean | void;
  /** 变化时重建编辑器（切便签）。正文传 note.id。 */
  resetKey?: string;
  placeholder?: string;
  className?: string;
  /** 应用到编辑器宿主 div 的样式（如最小高度）。 */
  contentClassName?: string;
  /** 暴露编辑器实例（外部插入链接等）。 */
  editorRef?: (editor: Editor | null) => void;
}

export default function NoteDocumentEditor({
  documentJson,
  mode,
  content,
  checklistItems,
  checklistGroups,
  onChange,
  linkableNotes,
  onOpenNote,
  resetKey,
  placeholder = "",
  className,
  contentClassName,
  editorRef,
}: Props) {
  // 全部动态回调走 ref：useEditor 只在挂载/ resetKey 变化时读取一次 options
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onOpenNoteRef = useRef(onOpenNote);
  onOpenNoteRef.current = onOpenNote;
  const notesRef = useRef(linkableNotes);
  notesRef.current = linkableNotes;
  const editorRefRef = useRef(editorRef);
  editorRefRef.current = editorRef;

  const lastSentRef = useRef<string | null>(null);

  // 浮层状态/过滤/键盘接管抽到 useNoteLinkSuggest（与 LinkEditor 共用）。
  // 必须先用 hook 再建编辑器：useEditor 的 options 在创建时一次性读取回调，
  // hook 通过 editorRef（useEffect 填充）访问编辑器实例。
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
      extensions: createDocumentExtensions({ placeholder }),
      content: parseNoteDocument({
        documentJson,
        mode,
        content,
        checklistItems,
        checklistGroups,
      }),
      onUpdate: ({ editor: ed }) => {
        const payload = docToNotePayload(ed.getJSON());
        if (payload.documentJson === lastSentRef.current) return;
        lastSentRef.current = payload.documentJson;
        onChangeRef.current?.(payload);
        detectSuggest();
      },
      onSelectionUpdate: () => detectSuggest(),
      editorProps: {
        handleKeyDown: (view, event) => {
          // 1. `[[` 浮层打开时优先接管键盘
          if (handleSuggestKeyDown(event)) return true;
          // 2. 文档仅一个待办块时禁止 Backspace/Delete 删除它（Document block+ 至少留一块）
          if (
            (event.key === "Backspace" || event.key === "Delete") &&
            view.state.selection instanceof NodeSelection
          ) {
            const n = view.state.selection.node;
            if (n.type.name === "checklistBlock" && view.state.doc.childCount === 1) {
              event.preventDefault();
              return true;
            }
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
          // 整块待办被选中时粘贴文本：忽略，避免误删待办块
          if (view.state.selection instanceof NodeSelection) {
            if (text) {
              event.preventDefault();
              return true;
            }
            return false;
          }
          if (!text) return false;
          // 段落区粘贴：按存储格式解析（[[note:...]] → 芯片，\n → hardBreak，URL → 纯文本）
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
  useEffect(() => {
    return () => editorRefRef.current?.(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // resetKey 变化重建编辑器（切便签）时，清掉可能残留的搜索浮层
  useEffect(() => {
    closeSuggest();
  }, [editor]);

  // 把 onOpenNote / linkableNotes 暴露给 checklistBlock 节点视图（按 editor 实例注册）
  useEffect(() => {
    if (!editor) return;
    setNodeViewContext(editor, {
      onOpenNote: onOpenNoteRef.current,
      linkableNotes: notesRef.current,
    });
  }, [editor, linkableNotes]);
  useEffect(() => {
    const ed = editor;
    return () => {
      if (ed) removeNodeViewContext(ed);
    };
  }, [editor]);

  // 外部正文状态变化（切便签由 resetKey 重建、远端更新走这里）：
  // 与自身输出回环相同（投影相等）则跳过，否则替换 doc 不丢撤销栈。
  // M16 风险点修复：documentJson 为权威（非 null）时直接按它比较——否则加粗/斜体等
  // 只改 documentJson 不改投影的改动会被判为"无变化"而跳过应用；旧数据（null）回退投影比较。
  useEffect(() => {
    if (!editor) return;
    const current = docToNotePayload(editor.getJSON());
    const upToDate =
      documentJson !== null
        ? current.documentJson === documentJson
        : current.content === content &&
          JSON.stringify(current.checklistItems) ===
            JSON.stringify(checklistItems) &&
          current.mode === mode;
    if (upToDate) return;
    closeSuggest();
    const doc = editor.schema.nodeFromJSON(
      parseNoteDocument({
        documentJson,
        mode,
        content,
        checklistItems,
        checklistGroups,
      })
    );
    editor.view.dispatch(
      editor.state.tr
        .replaceWith(0, editor.state.doc.content.size, doc)
        .setMeta("preventUpdate", true)
        .setMeta("addToHistory", false)
    );
  }, [editor, documentJson, mode, content, checklistItems, checklistGroups]);

  const handleWrapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement;
    if (t.closest?.(".ProseMirror")) return;
    // 点击待办块（节点视图，非 .ProseMirror）不抢焦点，避免勾选按钮等操作把外层光标移到末尾
    if (t.closest?.("[data-checklist-block]")) return;
    editor?.commands.focus("end");
  };

  return (
    <div
      className={className}
      onBlur={() => closeSuggest()}
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
