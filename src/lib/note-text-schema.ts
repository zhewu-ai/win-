import { Extension, Node, mergeAttributes } from "@tiptap/core";
import type { JSONContent } from "@tiptap/core";
import Document from "@tiptap/extension-document";
import Text from "@tiptap/extension-text";
import HardBreak from "@tiptap/extension-hard-break";
import History from "@tiptap/extension-history";
import Placeholder from "@tiptap/extension-placeholder";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as PMNode } from "@tiptap/pm/model";
import NoteLinkView from "@/components/NoteLinkView";
import { findUrlSpans, parseNoteLinks } from "./link-parser";

// ──────────────────────────────────────────────────────────────────────────
// noteText：单个正文块（text 便签正文 / 待办行 / 小标题共用）。
// 换行用 hardBreak 节点表示；外部 URL 用装饰（<a>）显示，内部便签用 noteLink 原子节点。
// 底层保存仍是纯文本，序列化/解析恒等：serialize(parse(text)) === text。
// ──────────────────────────────────────────────────────────────────────────

const NoteText = Node.create({
  name: "noteText",
  group: "block",
  content: "inline*",
  // 换行由 hardBreak 节点承载，文本节点不含 \n；"pre" 保留空格不折叠
  whitespace: "pre",
  parseHTML() {
    return [{ tag: "div[data-note-text]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-note-text": "true",
        class: "note-text",
      }),
      0, // 内容孔：把内联内容渲染进此 div（缺了会被 PM 当作 leaf，不可编辑）
    ];
  },
});

const NoteLink = Node.create({
  name: "noteLink",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,
  addAttributes() {
    return {
      id: { default: null },
      title: { default: "" },
    };
  },
  parseHTML() {
    return [{ tag: "span[data-note-link]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, { "data-note-link": "true" }),
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(NoteLinkView);
  },
  // 复制/导出文本时输出原始语法，保证剪贴板内容与存储格式一致
  renderText({ node }) {
    return `[[note:${node.attrs.id}|${node.attrs.title}]]`;
  },
});

// 外部 URL 装饰：事务后扫描 noteText 内联文本，命中区间加 Decoration.inline(<a>)。文档里 URL 永远是纯文本。
const URL_LINK_KEY = new PluginKey("noteTextUrlLink");

const urlLinkPlugin: Plugin<DecorationSet> = new Plugin({
  key: URL_LINK_KEY,
  state: {
    init: (_config, state) => computeUrlDecorations(state.doc),
    apply: (tr, value, _oldState, newState) =>
      tr.docChanged ? computeUrlDecorations(newState.doc) : value,
  },
  props: {
    decorations: (state) => urlLinkPlugin.getState(state),
  },
});

function computeUrlDecorations(doc: PMNode): DecorationSet {
  const decorations: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name !== "noteText") return;
    node.content.forEach((child, childOffset) => {
      if (!child.isText) return;
      const start = pos + 1 + childOffset;
      const spans = findUrlSpans(child.text ?? "");
      for (const s of spans) {
        decorations.push(
          Decoration.inline(start + s.from, start + s.to, {
            nodeName: "a",
            href: s.href,
            target: "_blank",
            rel: "noopener noreferrer",
            class: "url-link",
          })
        );
      }
    });
  });
  return DecorationSet.create(doc, decorations);
}

const NoteUrlLink = Extension.create({
  name: "noteUrlLink",
  addProseMirrorPlugins() {
    return [urlLinkPlugin];
  },
});

/** 构造编辑器扩展集合；placeholder 按实例传入（正文/待办行/小标题各自不同）。 */
export function createNoteExtensions(options: { placeholder: string }) {
  return [
    Document.extend({ content: "noteText" }),
    Text,
    // 复制/导出文本时把 hardBreak 还原为换行，避免多行内容被压平
    HardBreak.extend({ renderText: () => "\n" }),
    History,
    Placeholder.configure({
      placeholder: options.placeholder,
      emptyNodeClass: "is-editor-empty",
      emptyEditorClass: "is-editor-empty",
      showOnlyWhenEditable: true,
      showOnlyCurrent: false,
      includeChildren: false,
    }),
    NoteText,
    NoteLink,
    NoteUrlLink,
  ];
}

/** 把编辑器文档序列化成存储用的纯文本。 */
export function serializeNoteText(doc: PMNode): string {
  const block = doc.firstChild;
  if (!block) return "";
  let out = "";
  block.content.forEach((child) => {
    if (child.isText) {
      out += child.text ?? "";
    } else if (child.type.name === "hardBreak") {
      out += "\n";
    } else if (child.type.name === "noteLink") {
      out += `[[note:${child.attrs.id}|${child.attrs.title}]]`;
    }
  });
  return out;
}

type InlineJSON =
  | { type: "text"; text: string }
  | { type: "hardBreak" }
  | { type: "noteLink"; attrs: { id: string; title: string } };

/** 把存储用的纯文本解析成编辑器文档。 */
export function parseNoteText(text: string): {
  type: "doc";
  content: Array<{ type: "noteText"; content: InlineJSON[] }>;
} {
  const segments = parseNoteLinks(text);
  const inline: InlineJSON[] = [];
  for (const seg of segments) {
    if (seg.type === "note") {
      inline.push({
        type: "noteLink",
        attrs: { id: seg.noteId, title: seg.title },
      });
      continue;
    }
    // url 段也作为纯文本保存（由装饰插件显蓝），doc 里 URL 永远是纯文本
    const parts = seg.text.split("\n");
    parts.forEach((line, i) => {
      if (i > 0) inline.push({ type: "hardBreak" });
      if (line.length > 0) inline.push({ type: "text", text: line });
    });
  }
  return { type: "doc", content: [{ type: "noteText", content: inline }] };
}
