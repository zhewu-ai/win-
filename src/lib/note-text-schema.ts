import { Extension, Mark, Node, mergeAttributes } from "@tiptap/core";
import type { JSONContent } from "@tiptap/core";
import Document from "@tiptap/extension-document";
import Text from "@tiptap/extension-text";
import HardBreak from "@tiptap/extension-hard-break";
import History from "@tiptap/extension-history";
import Placeholder from "@tiptap/extension-placeholder";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { NodeSelection, Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as PMNode } from "@tiptap/pm/model";
import NoteLinkView from "@/components/NoteLinkView";
import ChecklistBlockView from "@/components/ChecklistBlockView";
import { escapeLinkTitle, findUrlSpans, parseNoteLinks } from "./link-parser";
import { normalizeChecklist, NOTE_CONTENT_MAX } from "./note-serializer";
import type { ChecklistItem, ChecklistGroup } from "@/types";

// M16 统一文档：documentJson（Tiptap JSON，block+）为权威结构；
// content/checklistItems 是派生投影，仅供搜索/列表预览/旧端展示，永不反向重建文档。

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
  // 复制/导出文本时输出原始语法，保证剪贴板内容与存储格式一致（标题转义防 ] 破坏语法）
  renderText({ node }) {
    return `[[note:${node.attrs.id}|${escapeLinkTitle(node.attrs.title)}]]`;
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
      out += `[[note:${child.attrs.id}|${escapeLinkTitle(child.attrs.title)}]]`;
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

// ──────────────────────────────────────────────────────────────────────────
// M16 统一文档（block+）：noteText 段落块 + checklistBlock 待办块混排。
// 存储 = documentJson（权威）；content / checklistItems 为派生投影。
// 回滚路径：忽略 documentJson，回旧双模式编辑器读投影，两字段始终完整。
// ──────────────────────────────────────────────────────────────────────────

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function emptyRow(): ChecklistItem {
  const now = new Date().toISOString();
  return {
    id: uid(),
    kind: "todo",
    text: "",
    checked: false,
    sortOrder: 0,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  };
}

/** 导出空待办行：供「插入待办块」构造 checklistBlock attrs.rows 使用。 */
export function emptyChecklistRow(): ChecklistItem {
  return emptyRow();
}

/** checklistBlock：atom 叶子块，行存 attrs.rows（JSON），不建子节点——行编辑复用 ChecklistRow（singleLine LinkEditor）。 */
const ChecklistBlock = Node.create({
  name: "checklistBlock",
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,
  addAttributes() {
    return {
      // 不渲染进 DOM/不参与 parseHTML：文档持久化走 JSON（documentJson）
      rows: { default: [], renderHTML: false },
    };
  },
  parseHTML() {
    return [{ tag: "div[data-checklist-block]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-checklist-block": "true" }),
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(ChecklistBlockView);
  },
});

// ──────────────────────────────────────────────────────────────────────────
// P1 轻量格式：加粗/斜体 mark + 标题/引用/分割线 块。
// 标题与引用是独立 block（内联内容与 noteText 同级）；分割线为 atom 叶子块。
// 存储以 documentJson 为准；投影格式：# 标题 / > 引用 / --- 分割线。
// ──────────────────────────────────────────────────────────────────────────

const Bold = Mark.create({
  name: "bold",
  parseHTML() {
    return [{ tag: "strong" }, { tag: "b" }];
  },
  renderHTML() {
    return ["strong"];
  },
});

const Italic = Mark.create({
  name: "italic",
  parseHTML() {
    return [{ tag: "em" }, { tag: "i" }];
  },
  renderHTML() {
    return ["em"];
  },
});

const Heading = Node.create({
  name: "heading",
  group: "block",
  content: "inline*",
  addAttributes() {
    return { level: { default: 2 } };
  },
  parseHTML() {
    return [
      { tag: "h1", attrs: { level: 1 } },
      { tag: "h2", attrs: { level: 2 } },
      { tag: "h3", attrs: { level: 3 } },
    ];
  },
  renderHTML({ node, HTMLAttributes }) {
    const level = node.attrs.level ?? 2;
    return [`h${level}`, mergeAttributes(HTMLAttributes, { "data-heading": "true" }), 0];
  },
});

const Quote = Node.create({
  name: "quote",
  group: "block",
  content: "inline*",
  parseHTML() {
    return [{ tag: "blockquote" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["blockquote", mergeAttributes(HTMLAttributes, { "data-quote": "true" }), 0];
  },
});

const Divider = Node.create({
  name: "divider",
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,
  parseHTML() {
    return [{ tag: "hr" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["hr", mergeAttributes(HTMLAttributes, { "data-divider": "true" })];
  },
  // 复制/导出文本时还原为分割线语法
  renderText() {
    return "---";
  },
  addCommands() {
    return {
      setDivider:
        () =>
        ({ state, tr, dispatch }) => {
          // 折叠光标在非空文本块内时，insertContent 对块节点静默失败；
          // 改为显式在当前顶层块之后插入分割线，再保证块后有段落承接光标。
          let insertPos: number;
          if (state.selection instanceof NodeSelection) {
            insertPos = state.selection.to;
          } else {
            const { $from } = state.selection;
            insertPos = $from.depth > 0 ? $from.after($from.depth) : $from.pos;
          }
          tr.insert(insertPos, state.schema.nodes.divider.create());
          // map(insertPos) 已是分割线之后的位置（插入点映射到新节点后），无需 +1
          const dividerEnd = tr.mapping.map(insertPos);
          if (tr.doc.nodeAt(dividerEnd)) {
            tr.setSelection(TextSelection.create(tr.doc, dividerEnd));
          } else {
            // 分割线已在文档末尾：补一个空 noteText 段落承接光标
            const para = state.schema.nodes.noteText.createAndFill();
            if (para) tr.insert(dividerEnd, para);
            tr.setSelection(TextSelection.create(tr.doc, dividerEnd));
          }
          if (dispatch) dispatch(tr);
          return true;
        },
    };
  },
});

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    divider: {
      setDivider: () => ReturnType;
    };
  }
}

/** 构造统一文档编辑器扩展集合（段落 + checklist 块混排）。 */
export function createDocumentExtensions(options: { placeholder: string }) {
  return [
    // Document 默认 content "block+"（多块），不再单块约束
    Document,
    Text,
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
    ChecklistBlock,
    Bold,
    Italic,
    Heading,
    Quote,
    Divider,
  ];
}

/** 内联数组（paragraph 内容）→ 纯文本（hardBreak→\n，noteLink→原始语法）。 */
export function inlineToText(inline: JSONContent[] | undefined): string {
  let out = "";
  for (const child of inline ?? []) {
    if (child.type === "text") {
      out += child.text ?? "";
    } else if (child.type === "hardBreak") {
      out += "\n";
    } else if (child.type === "noteLink") {
      out += `[[note:${child.attrs?.id}|${escapeLinkTitle(
        String(child.attrs?.title ?? "")
      )}]]`;
    }
  }
  return out;
}

/** 校验/清洗 documentJson，防止坏数据崩溃编辑器。无法安全解析时返回 null（走旧字段推导）。 */
function sanitizeDocumentJson(raw: string): JSONContent | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const doc = parsed as Record<string, unknown>;
  if (doc.type !== "doc" || !Array.isArray(doc.content)) return null;

  const content: JSONContent[] = [];
  for (const b of doc.content) {
    if (!b || typeof b !== "object") continue;
    const block = b as Record<string, unknown>;
    if (block.type === "noteText") {
      content.push({ type: "noteText", content: sanitizeInline(block.content) });
    } else if (block.type === "heading") {
      const attrs =
        block.attrs && typeof block.attrs === "object"
          ? (block.attrs as Record<string, unknown>)
          : {};
      const lv = Number(attrs.level);
      content.push({
        type: "heading",
        attrs: { level: [1, 2, 3].includes(lv) ? lv : 2 },
        content: sanitizeInline(block.content),
      });
    } else if (block.type === "quote") {
      content.push({ type: "quote", content: sanitizeInline(block.content) });
    } else if (block.type === "divider") {
      content.push({ type: "divider" });
    } else if (block.type === "checklistBlock") {
      const attrs =
        block.attrs && typeof block.attrs === "object"
          ? (block.attrs as Record<string, unknown>)
          : {};
      content.push({
        type: "checklistBlock",
        attrs: { rows: sanitizeRows(attrs.rows) },
      });
    }
  }
  if (content.length === 0) return null;
  return { type: "doc", content };
}

function sanitizeInline(raw: unknown): JSONContent[] {
  if (!Array.isArray(raw)) return [];
  const out: JSONContent[] = [];
  for (const n of raw) {
    if (!n || typeof n !== "object") continue;
    const node = n as Record<string, unknown>;
    if (node.type === "text" && typeof node.text === "string") {
      const marks = (Array.isArray(node.marks) ? node.marks : [])
        .filter(
          (m): m is { type: string } =>
            !!m && typeof m === "object" && (m.type === "bold" || m.type === "italic")
        )
        .map((m) => ({ type: m.type as "bold" | "italic" }));
      out.push(
        marks.length > 0
          ? { type: "text", text: node.text, marks }
          : { type: "text", text: node.text }
      );
    } else if (node.type === "hardBreak") {
      out.push({ type: "hardBreak" });
    } else if (node.type === "noteLink") {
      const attrs =
        node.attrs && typeof node.attrs === "object"
          ? (node.attrs as Record<string, unknown>)
          : {};
      out.push({
        type: "noteLink",
        attrs: {
          id: String(attrs.id ?? ""),
          title: String(attrs.title ?? ""),
        },
      });
    }
  }
  return out;
}

function sanitizeRows(raw: unknown): ChecklistItem[] {
  if (!Array.isArray(raw)) return [];
  const out: ChecklistItem[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const row = r as Record<string, unknown>;
    const id = typeof row.id === "string" && row.id ? row.id : uid();
    const kind = row.kind === "heading" ? "heading" : "todo";
    const checked = kind === "todo" && row.checked === true;
    out.push({
      id,
      kind,
      text: typeof row.text === "string" ? row.text : "",
      checked,
      sortOrder: typeof row.sortOrder === "number" ? row.sortOrder : 0,
      createdAt:
        typeof row.createdAt === "string"
          ? row.createdAt
          : new Date().toISOString(),
      updatedAt:
        typeof row.updatedAt === "string"
          ? row.updatedAt
          : new Date().toISOString(),
      completedAt: typeof row.completedAt === "string" ? row.completedAt : null,
      groupId: typeof row.groupId === "string" ? row.groupId : undefined,
    });
  }
  return out;
}

/** 从便签数据推导编辑器初始文档：documentJson 优先，旧数据按 mode 懒迁移生成。 */
export function parseNoteDocument(note: {
  documentJson?: string | null;
  mode?: string | null;
  content?: string | null;
  checklistItems?: ChecklistItem[] | null;
  checklistGroups?: ChecklistGroup[] | null;
}): JSONContent {
  if (note.documentJson) {
    const sanitized = sanitizeDocumentJson(note.documentJson);
    if (sanitized) return sanitized;
  }
  if (note.mode === "checklist") {
    const { items } = normalizeChecklist(
      note.checklistItems ?? [],
      note.checklistGroups ?? []
    );
    const rows = items.length > 0 ? items : [emptyRow()];
    return { type: "doc", content: [{ type: "checklistBlock", attrs: { rows } }] };
  }
  const inline = parseNoteText(note.content ?? "").content[0].content;
  return { type: "doc", content: [{ type: "noteText", content: inline }] };
}

/** checklist 行 → 内容投影行（todo `[ ]`/`[x]`，heading `# `）。空文本行不投影。 */
function rowToLine(row: ChecklistItem): string {
  const t = (row.text ?? "").trim();
  if (!t) return "";
  if (row.kind === "heading") return `# ${t}`;
  return `[${row.checked ? "x" : " "}] ${t}`;
}

/** 把编辑器文档序列化成存储载荷：documentJson（权威）+ content / checklistItems（投影）。 */
export function serializeNoteDocument(doc: JSONContent): {
  documentJson: string;
  content: string;
  checklistItems: ChecklistItem[];
} {
  const blocks = Array.isArray(doc.content) ? doc.content : [];
  const lines: string[] = [];
  const checklistItems: ChecklistItem[] = [];
  let prevType: string | null = null;
  for (const block of blocks) {
    if (block.type === "noteText") {
      const line = inlineToText(block.content);
      // 不同块类型之间用空行分隔；相邻段落同属连续文本，不加分隔
      if (prevType && prevType !== "noteText") lines.push("");
      lines.push(line);
      prevType = "noteText";
    } else if (block.type === "heading") {
      const t = inlineToText(block.content).trim();
      if (prevType && prevType !== "heading") lines.push("");
      if (t) lines.push(`# ${t}`);
      prevType = "heading";
    } else if (block.type === "quote") {
      const t = inlineToText(block.content).trim();
      if (prevType && prevType !== "quote") lines.push("");
      if (t) lines.push(`> ${t}`);
      prevType = "quote";
    } else if (block.type === "divider") {
      if (prevType) lines.push("");
      lines.push("---");
      prevType = "divider";
    } else if (block.type === "checklistBlock") {
      const rows = (Array.isArray(block.attrs?.rows)
        ? block.attrs.rows
        : []) as ChecklistItem[];
      if (prevType) lines.push("");
      for (const row of rows) {
        const line = rowToLine(row);
        if (line) lines.push(line);
      }
      prevType = "checklistBlock";
      checklistItems.push(...rows);
    }
  }
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  // 投影受文本上限约束：超长（罕见大清单）截断，避免触顶 CONTENT_TOO_LONG；搜索仍走 checklistItems
  let content = lines.join("\n");
  if (content.length > NOTE_CONTENT_MAX) content = content.slice(0, NOTE_CONTENT_MAX);
  return { documentJson: JSON.stringify(doc), content, checklistItems };
}

/** 文档 → 一次保存的全部正文相关字段（统一编辑器保存统一走这里）。 */
export function docToNotePayload(doc: JSONContent): {
  documentJson: string;
  content: string;
  checklistItems: ChecklistItem[];
  checklistGroups: ChecklistGroup[];
  mode: "text" | "checklist";
} {
  const { documentJson, content, checklistItems } = serializeNoteDocument(doc);
  const hasChecklist = (doc.content ?? []).some(
    (b) => b.type === "checklistBlock"
  );
  return {
    documentJson,
    content,
    checklistItems,
    checklistGroups: [],
    mode: hasChecklist ? "checklist" : "text",
  };
}
