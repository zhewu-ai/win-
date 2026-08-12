/**
 * M16R1 阶段1 旧数据回归：验证统一文档解析/投影对旧便签数据无损。
 * 运行：npx tsx scripts/legacy-migration-check.ts
 */
import {
  parseNoteDocument,
  parseNoteText,
  docToNotePayload,
  serializeNoteDocument,
} from "../src/lib/note-text-schema";
import type { ChecklistItem } from "../src/types";

let fails = 0;
function assert(name: string, cond: boolean, extra?: string) {
  if (!cond) {
    fails++;
    console.error("FAIL:", name, extra ? ` [${extra}]` : "");
  } else {
    console.log("ok  :", name);
  }
}
function sameRows(a: ChecklistItem[], b: ChecklistItem[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((r, i) => {
    const o = b[i];
    return (
      r.id === o.id &&
      r.kind === o.kind &&
      r.text === o.text &&
      r.checked === o.checked &&
      r.sortOrder === o.sortOrder
    );
  });
}

// 1) 旧 text 便签（documentJson=null, mode=text）：单段落，content 原样往返
{
  const doc = parseNoteDocument({
    documentJson: null,
    mode: "text",
    content: "hello world",
    checklistItems: [],
    checklistGroups: [],
  });
  assert(
    "legacy text -> single noteText block",
    doc.content?.length === 1 && doc.content[0].type === "noteText"
  );
  const payload = docToNotePayload(doc);
  assert("legacy text content roundtrip", payload.content === "hello world");
  assert("legacy text mode stays text", payload.mode === "text");
  assert("legacy text no checklist items", payload.checklistItems.length === 0);
}

// 2) 旧 text 多行 + 内部链接语法：换行/芯片在文档与投影间无损
{
  const content = "line1\nline2 [[note:abc|标题]] tail https://e.com/1";
  const doc = parseNoteDocument({
    documentJson: null,
    mode: "text",
    content,
    checklistItems: [],
    checklistGroups: [],
  });
  const payload = docToNotePayload(doc);
  assert(
    "legacy multiline+link content roundtrip",
    payload.content === content,
    `in=${JSON.stringify(content)} out=${JSON.stringify(payload.content)}`
  );
}

// 3) 旧 checklist 便签：单 checklistBlock，行结构（待办/勾选/标题）无损
{
  const now = new Date().toISOString();
  const items: ChecklistItem[] = [
    { id: "a", kind: "todo", text: "todo open", checked: false, sortOrder: 0, createdAt: now, updatedAt: now, completedAt: null },
    { id: "b", kind: "todo", text: "todo done", checked: true, sortOrder: 1, createdAt: now, updatedAt: now, completedAt: now },
    { id: "c", kind: "heading", text: "分组", checked: false, sortOrder: 2, createdAt: now, updatedAt: now, completedAt: null },
  ];
  const doc = parseNoteDocument({
    documentJson: null,
    mode: "checklist",
    content: "",
    checklistItems: items,
    checklistGroups: [],
  });
  assert(
    "legacy checklist -> single checklistBlock",
    doc.content?.length === 1 && doc.content[0].type === "checklistBlock"
  );
  const rows = doc.content![0].attrs?.rows as ChecklistItem[];
  assert("rows order preserved", sameRows(rows, items));
  const payload = docToNotePayload(doc);
  assert(
    "checklist items roundtrip",
    sameRows(payload.checklistItems, items)
  );
  assert("checklist mode stays checklist", payload.mode === "checklist");
  assert(
    "content projection lines",
    payload.content === "[ ] todo open\n[x] todo done\n# 分组",
    `got=${JSON.stringify(payload.content)}`
  );
}

// 4) 旧 checklist 空清单：至少生成一行可输入
{
  const doc = parseNoteDocument({
    documentJson: null,
    mode: "checklist",
    content: "",
    checklistItems: [],
    checklistGroups: [],
  });
  const rows = doc.content![0].attrs?.rows as ChecklistItem[];
  assert("empty checklist -> 1 empty row", rows.length === 1 && rows[0].text === "");
}

// 5) 坏 documentJson：安全回退到旧字段推导，不崩溃
{
  const doc = parseNoteDocument({
    documentJson: "{not json",
    mode: "text",
    content: "fallback",
    checklistItems: [],
    checklistGroups: [],
  });
  const payload = docToNotePayload(doc);
  assert("bad documentJson falls back to text", payload.content === "fallback");
}

// 6) 已有 documentJson（混合块）：sanitize 后往返，投影含块间空行分隔
{
  const json = JSON.stringify({
    type: "doc",
    content: [
      { type: "noteText", content: [{ type: "text", text: "前言" }] },
      { type: "checklistBlock", attrs: { rows: [
        { id: "x1", kind: "todo", text: "do it", checked: true, sortOrder: 0, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", completedAt: "2026-01-01T00:00:00.000Z" },
      ] } },
      { type: "noteText", content: [{ type: "text", text: "结尾" }] },
    ],
  });
  const doc = parseNoteDocument({
    documentJson: json,
    mode: "checklist",
    content: "旧投影",
    checklistItems: [],
    checklistGroups: [],
  });
  assert("mixed doc keeps 3 blocks", doc.content?.length === 3);
  assert("mixed doc block order", doc.content![0].type === "noteText" && doc.content![1].type === "checklistBlock" && doc.content![2].type === "noteText");
  const payload = docToNotePayload(doc);
  assert(
    "mixed content projection blank-line sep",
    payload.content === "前言\n\n[x] do it\n\n结尾",
    `got=${JSON.stringify(payload.content)}`
  );
  assert("mixed mode checklist", payload.mode === "checklist");
}

// 7) parseNoteText 仍独立可用（旧编辑器路径不受影响）
{
  const doc = parseNoteText("a\nb");
  assert("parseNoteText single block preserved", doc.content.length === 1 && doc.content[0].type === "noteText");
  assert("parseNoteText newline as hardBreak", (doc.content[0].content as unknown[]).some((n) => (n as { type: string }).type === "hardBreak"));
}

console.log(fails === 0 ? "\nALL PASS" : `\n${fails} FAILURES`);
process.exit(fails === 0 ? 0 : 1);
