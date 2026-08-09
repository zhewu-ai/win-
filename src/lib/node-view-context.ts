import type { Editor } from "@tiptap/react";

export interface NodeViewContext {
  /** 点击内部便签芯片时打开目标便签（由页面层实现返回栈）；返回 false 表示目标失效/无权限，芯片置灰。 */
  onOpenNote?: (noteId: string) => Promise<boolean> | boolean | void;
}

const registry = new WeakMap<Editor, NodeViewContext>();

export function setNodeViewContext(editor: Editor, ctx: NodeViewContext) {
  registry.set(editor, ctx);
}

export function removeNodeViewContext(editor: Editor) {
  registry.delete(editor);
}

export function getNodeViewContext(editor: Editor): NodeViewContext | undefined {
  return registry.get(editor);
}
