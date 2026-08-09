"use client";

import { useState, type MouseEvent as ReactMouseEvent } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { getNodeViewContext } from "@/lib/node-view-context";

/** 内部便签链接的芯片外观：点击打开目标便签；打开失败（目标失效/无权限）后置灰。 */
export default function NoteLinkView({ node, editor }: NodeViewProps) {
  const ctx = getNodeViewContext(editor);
  // 延迟判定失效：不在打开时预校验，避免每条链接一次请求（与 LinkedText 语义一致）
  const [failed, setFailed] = useState(false);
  const title = (node.attrs.title as string) || "未命名便签";

  const handleClick = async (e: ReactMouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (failed) return;
    if (!ctx?.onOpenNote) {
      setFailed(true);
      return;
    }
    const ok = await ctx.onOpenNote(node.attrs.id as string);
    if (ok === false) setFailed(true);
  };

  return (
    <NodeViewWrapper
      as="span"
      contenteditable={false}
      onMouseDown={(e: ReactMouseEvent) => e.preventDefault()}
      onClick={handleClick}
      className={
        failed
          ? "inline-flex items-center gap-1 rounded-md bg-ink-muted/10 px-1.5 py-0.5 text-ink-muted/60 line-through decoration-ink-muted/40 cursor-not-allowed select-none"
          : "inline-flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-primary hover:bg-primary/15 transition-colors cursor-pointer select-none"
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
        {failed ? `${title}（已失效）` : title}
      </span>
    </NodeViewWrapper>
  );
}
