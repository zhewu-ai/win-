export type LinkSegment =
  | { type: "text"; text: string }
  | { type: "url"; text: string; href: string }
  | { type: "note"; noteId: string; title: string };

// 内部便签链接语法：[[note:NOTE_ID|显示标题]]
// noteId 只允许字母/数字/下划线/连字符（cuid 形状），标题用 [^\]]+ 避免吞掉 ]]。
const NOTE_LINK_RE = /\[\[note:([A-Za-z0-9_-]+)\|([^\]]+)\]\]/g;
const NOTE_ID_RE = /^[A-Za-z0-9_-]+$/;

// 外部 URL：http(s):// 或 www. 开头；在中文字符与常见全角标点处截断（这些不可能是 URL 一部分）。
const URL_RE =
  /(?:https?:\/\/|www\.)[^\s<>"'　-〿＀-￯，。；：！？、]+/g;

// 尾部 ASCII/半角标点：不应吞进链接（。，,．. ) ）] 】" 等）。
const TRAILING_RE = /[.,;:!?)\]}"'》〉】]+$/;

export interface UrlSpan {
  /** URL 在原始文本中的起始下标（含） */
  from: number;
  /** URL 在原始文本中的结束下标（不含） */
  to: number;
  text: string;
  href: string;
}

/** 找出文本中所有外部 URL 区间（返回原始文本坐标）。被解析层与编辑器的装饰插件共用。 */
export function findUrlSpans(text: string): UrlSpan[] {
  const spans: UrlSpan[] = [];
  let rest = text;
  let offset = 0;
  while (rest) {
    URL_RE.lastIndex = 0;
    const m = URL_RE.exec(rest);
    if (!m) break;

    let raw = m[0];
    const after = rest.slice(m.index + raw.length);
    const trail = raw.match(TRAILING_RE);
    if (trail) raw = raw.slice(0, raw.length - trail[0].length);
    // 被裁剪掉的标点放回剩余文本，作为链接后面的普通文本
    const restAfter = trail ? trail[0] + after : after;

    const href =
      raw.startsWith("http://") || raw.startsWith("https://")
        ? raw
        : `https://${raw}`;

    if (raw.length > 0 && /^https?:\/\//.test(href)) {
      spans.push({
        from: offset + m.index,
        to: offset + m.index + raw.length,
        text: raw,
        href,
      });
    }
    offset += m.index + m[0].length;
    rest = restAfter;
  }
  return spans;
}

function splitUrls(text: string): LinkSegment[] {
  const spans = findUrlSpans(text);
  if (spans.length === 0) return [{ type: "text", text }];
  const out: LinkSegment[] = [];
  let last = 0;
  for (const s of spans) {
    if (s.from > last) out.push({ type: "text", text: text.slice(last, s.from) });
    out.push({ type: "url", text: s.text, href: s.href });
    last = s.to;
  }
  if (last < text.length) out.push({ type: "text", text: text.slice(last) });
  return out;
}

/** 把便签正文解析为文本 / 外部链接 / 内部链接片段。不做 HTML 拼接，供组件安全渲染。 */
export function parseNoteLinks(text: string): LinkSegment[] {
  const chunks: LinkSegment[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  NOTE_LINK_RE.lastIndex = 0;
  while ((m = NOTE_LINK_RE.exec(text))) {
    if (m.index > last) chunks.push({ type: "text", text: text.slice(last, m.index) });
    const noteId = m[1];
    if (NOTE_ID_RE.test(noteId)) {
      chunks.push({ type: "note", noteId, title: m[2] });
    } else {
      chunks.push({ type: "text", text: m[0] });
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) chunks.push({ type: "text", text: text.slice(last) });

  const out: LinkSegment[] = [];
  for (const seg of chunks) {
    if (seg.type !== "text") {
      out.push(seg);
      continue;
    }
    out.push(...splitUrls(seg.text));
  }
  return out;
}
