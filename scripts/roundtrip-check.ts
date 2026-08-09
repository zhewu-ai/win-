import { getSchema } from "@tiptap/core";
import { createNoteExtensions, parseNoteText, serializeNoteText } from "../src/lib/note-text-schema";
import { escapeLinkTitle, unescapeLinkTitle, parseNoteLinks } from "../src/lib/link-parser";

let fails = 0;
function assert(name: string, cond: boolean, extra?: string) {
  if (!cond) {
    fails++;
    console.error("FAIL:", name, extra ? ` [${extra}]` : "");
  } else {
    console.log("ok  :", name);
  }
}

const schema = getSchema(createNoteExtensions({ placeholder: "" }));
function roundtrip(name: string, t: string) {
  const doc = schema.nodeFromJSON(parseNoteText(t));
  const out = serializeNoteText(doc);
  assert(`${name} roundtrip`, out === t, `in=${JSON.stringify(t)} out=${JSON.stringify(out)}`);
}

// escape / unescape 互逆
const titles = ["A]B", "A\\B", "A]]B", "A]B\\C", "plain", "a|b", "\\", "]", "[]", ""];
for (const t of titles) {
  assert(`escape/unescape [${t}]`, unescapeLinkTitle(escapeLinkTitle(t)) === t);
}
assert("escape ] -> \\]", escapeLinkTitle("A]B") === "A\\]B");
assert("escape \\ -> \\\\", escapeLinkTitle("A\\B") === "A\\\\B");
assert("escape ]] -> \\]\\]", escapeLinkTitle("A]]B") === "A\\]\\]B");

// parseNoteLinks 解析转义标题
const seg = parseNoteLinks("[[note:abc|A\\]B]]")[0];
assert("parse unescape title", seg.type === "note" && seg.noteId === "abc" && seg.title === "A]B");
const seg2 = parseNoteLinks("[[note:abc|A\\\\B]]")[0];
assert("parse unescape backslash", seg2.type === "note" && seg2.title === "A\\B");

// 完整 doc round-trip（存储态为转义后的形式）
roundtrip("plain", "hello world");
roundtrip("url", "see https://example.com/x, ok");
roundtrip("url trailing punct", "https://e.com/a。后");
roundtrip("normal link", "前置 [[note:abc|标题]] 后置");
roundtrip("link ] title", "[[note:abc|A\\]B]]");
roundtrip("link \\ title", "[[note:abc|A\\\\B]]");
roundtrip("link ]] title", "[[note:abc|A\\]\\]B]]");
roundtrip("link mixed", "x [[note:abc|A\\]B\\\\C]] y https://e.com/1 z");
roundtrip("multiline", "line1\nline2\n");
roundtrip("broken legacy unescaped ]", "text [[note:abc|A]B]] tail"); // 旧数据会退化，仅确认不抛异常

console.log(fails === 0 ? "\nALL PASS" : `\n${fails} FAILURES`);
process.exit(fails === 0 ? 0 : 1);
