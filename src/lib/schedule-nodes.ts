import type { WorkScheduleItem } from "@/types";
import { fromDateStr } from "@/lib/calendar-date";

// 关键交付节点识别（QA M13 4/6 共享）：基于关键词的轻量判定，不依赖 AI。
// 用于日历封面（未来 7 天）与「日/今日」页（未来 14 天）提示。

export interface KeyNode {
  item: WorkScheduleItem;
  dateStr: string;
  /** 距起始日天数：0 = 当天。 */
  daysFrom: number;
  /** 越小越优先。 */
  priority: number;
}

/** 命中任一 → 视为关键节点。 */
const NODE_WORDS = [
  "交",
  "提交",
  "确认",
  "反馈",
  "call",
  "单帧",
  "美术",
  "layout",
  "cutdown",
  "交付",
  "dco",
  "aco",
  "bco",
];
/** 明确「交付/提交/确认/call」→ 提升优先级（优先于普通制作/修改）。 */
const HIGH_WORDS = [
  "交",
  "提交",
  "确认",
  "交付",
  "call",
  "dco",
  "aco",
  "bco",
  "单帧",
  "美术",
  "cutdown",
];

export function futureKeyNodes(
  items: WorkScheduleItem[],
  fromStr: string,
  horizonDays: number,
  max: number
): KeyNode[] {
  const fromMs = fromDateStr(fromStr).getTime();
  const endMs = fromMs + horizonDays * 86400000;
  const nodes: KeyNode[] = [];
  for (const it of items) {
    const d = fromDateStr(it.startDate).getTime();
    if (d < fromMs || d > endMs) continue;
    const title = (it.title || "").toLowerCase();
    if (!NODE_WORDS.some((w) => title.includes(w))) continue;
    const daysFrom = Math.round((d - fromMs) / 86400000);
    const high = HIGH_WORDS.some((w) => title.includes(w)) ? 0 : 1;
    nodes.push({ item: it, dateStr: it.startDate, daysFrom, priority: high * 1000 + daysFrom });
  }
  nodes.sort((a, b) => a.priority - b.priority || (a.item.type === "node" ? -1 : 1));
  return nodes.slice(0, max);
}

export function keyNodeLabel(node: KeyNode): string {
  const { daysFrom, item } = node;
  const prefix = daysFrom === 0 ? "今天" : daysFrom === 1 ? "明天" : `${daysFrom} 天后`;
  return `${prefix} · ${item.title || "未命名"}`;
}
