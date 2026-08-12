"use client";

import { useCallback } from "react";
import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import type { ChecklistItem } from "@/types";
import ChecklistBlock from "./ChecklistBlock";
import { getNodeViewContext } from "@/lib/node-view-context";

/**
 * checklistBlock（atom 叶子块）的节点视图：把 attrs.rows 交给 ChecklistBlock 行渲染组件，
 * 行改动经 updateAttributes 写回节点（documentJson 持久化）；块内最后一行空行回车退出到块后新段落。
 */
export default function ChecklistBlockView({
  node,
  editor,
  updateAttributes,
  getPos,
}: NodeViewProps) {
  const rows = (node.attrs.rows ?? []) as ChecklistItem[];
  const ctx = getNodeViewContext(editor);

  const handleChange = useCallback(
    (next: ChecklistItem[]) => {
      updateAttributes({ rows: next });
    },
    [updateAttributes]
  );

  // 块内最后一行空行回车：在原子块后插入空段落并把光标放进去（M16 退出待办进入正文）
  const handleExitBlock = useCallback(() => {
    const pos = typeof getPos === "function" ? getPos() : getPos;
    if (typeof pos !== "number") return;
    const insertAt = pos + node.nodeSize;
    editor
      .chain()
      .insertContentAt(insertAt, { type: "noteText", content: [] })
      .run();
    editor.commands.setTextSelection(insertAt + 1);
  }, [editor, getPos, node.nodeSize]);

  return (
    <NodeViewWrapper as="div" data-checklist-block="true" className="my-1">
      <ChecklistBlock
        items={rows}
        onChange={handleChange}
        linkableNotes={ctx?.linkableNotes}
        onOpenNote={ctx?.onOpenNote}
        embedded
        onExitBlock={handleExitBlock}
      />
    </NodeViewWrapper>
  );
}
