/**
 * 重置 M16 验收测试便签为原始状态（供 browser-acceptance.ts 反复运行）。
 * 运行：npx tsx scripts/reset-m16-notes.ts
 */
import { prisma } from "../src/lib/prisma";

const ids = JSON.parse(require("fs").readFileSync("/tmp/m16_ids.txt", "utf8"));
const { legtext, legcheck, newunified, target } = ids;

const now = (d = "2026-08-12T00:00:00.000Z") => new Date(d).toISOString();
const row = (id: string, kind: string, text: string, checked: boolean, sortOrder: number, completedAt: string | null) => ({
  id, kind, text, checked, sortOrder,
  createdAt: now(), updatedAt: now(), completedAt: completedAt ? now() : null,
});

const legcheckItems = [
  row("L1", "todo", "买牛奶", false, 0, null),
  row("L2", "todo", "写周报", true, 1, now()),
  row("L3", "heading", "本周", false, 2, null),
];

const unifiedRows = [
  row("U1", "todo", "新统一待办一", false, 0, null),
  row("U2", "todo", "新统一待办二", false, 1, null),
];
const unifiedJson = JSON.stringify({
  type: "doc",
  content: [
    { type: "noteText", content: [{ type: "text", text: "统一文档开头段落" }] },
    { type: "checklistBlock", attrs: { rows: unifiedRows } },
    { type: "noteText", content: [{ type: "text", text: "结尾段落" }] },
  ],
});

async function main() {
  const targetNote = await prisma.note.findUnique({ where: { id: target } });
  if (targetNote) {
    await prisma.note.update({
      where: { id: target },
      data: { documentJson: null, mode: "text", content: "这是被引用的目标便签", checklistItems: "[]", checklistGroups: "[]" },
    });
    console.log("reset target:", target);
  }

  await prisma.note.update({
    where: { id: legtext },
    data: {
      documentJson: null,
      mode: "text",
      content: `第一行普通文字\n带内链 [[note:${target}|内链目标便签]] 和外部链接 https://example.com/abc\n第三行收尾`,
      checklistItems: "[]",
      checklistGroups: "[]",
    },
  });
  console.log("reset legtext:", legtext);

  await prisma.note.update({
    where: { id: legcheck },
    data: {
      documentJson: null,
      mode: "checklist",
      content: "[ ] 买牛奶\n[x] 写周报\n# 本周",
      checklistItems: JSON.stringify(legcheckItems),
      checklistGroups: "[]",
    },
  });
  console.log("reset legcheck:", legcheck);

  await prisma.note.update({
    where: { id: newunified },
    data: {
      documentJson: unifiedJson,
      mode: "checklist",
      content: "统一文档开头段落\n\n[ ] 新统一待办一\n[ ] 新统一待办二\n\n结尾段落",
      checklistItems: JSON.stringify(unifiedRows),
      checklistGroups: "[]",
    },
  });
  console.log("reset newunified:", newunified);

  await prisma.$disconnect();
  console.log("ALL RESET");
}
main().catch((e) => { console.error("RESET ERROR:", e.message); process.exit(1); });
