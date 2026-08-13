import { findUrlSpans } from "./link-parser";

export const TAG_NAME_MAX = 30;
export const TAGS_PER_NOTE_MAX = 20;

// 标签：前置必须是行首或分隔符（空白/全角标点/[ ]），避免 abc#tag、https://x/#frag 误识别。
// \p{L} 覆盖中英文，\p{N} 覆盖数字；_ - 允许内部连写。
const TAG_RE =
  /(?:^|[\s，。、；：！？（）]|[\]\[])#([\p{L}\p{N}_-]+)/gu;

/**
 * 从正文抽取 `#标签` 名合集。先按 findUrlSpans 把 URL 掩码为等长空格，
 * 规避 `https://x/#frag` 这类片段标识误当标签；再对掩码文本跑 TAG_RE。
 * 返回去重、trim、截断到 TAG_NAME_MAX 的标签名数组（保留出现顺序）。
 */
export function extractTags(text: string): string[] {
  if (!text) return [];
  const masked = maskUrls(text);
  const seen = new Set<string>();
  const out: string[] = [];
  TAG_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TAG_RE.exec(masked))) {
    const name = m[1].trim().slice(0, TAG_NAME_MAX);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
    if (out.length >= TAGS_PER_NOTE_MAX) break;
  }
  return out;
}

function maskUrls(text: string): string {
  const spans = findUrlSpans(text);
  if (spans.length === 0) return text;
  const chars = text.split("");
  for (const s of spans) {
    for (let i = s.from; i < s.to; i++) {
      if (chars[i] !== "\n") chars[i] = " ";
    }
  }
  return chars.join("");
}
