// 工作日历项目色板：纯前端/API 共用的静态定义与配色逻辑（无 prisma/服务端依赖）。
// colorKey 为 String 列，扩色只需改这里 + globals.css 的 wp-* 变量。

export const PROJECT_COLOR_KEYS = [
  "blue",
  "cyan",
  "green",
  "lime",
  "amber",
  "orange",
  "red",
  "pink",
  "purple",
  "gray",
] as const;

export type ProjectColorKey = (typeof PROJECT_COLOR_KEYS)[number];

export function isValidProjectColor(s: string): boolean {
  return (PROJECT_COLOR_KEYS as readonly string[]).includes(s);
}

function isKey(c: unknown): c is ProjectColorKey {
  return typeof c === "string" && isValidProjectColor(c);
}

/**
 * 自动配色：优先未使用色，其次最少使用色；gray 兜底放在色环末尾，不做常规首选。
 * existing = 已存在项目的颜色；desired = 本次想用的颜色（可能非法/重复/缺省）。
 * 返回与 desired 等长、尽量不重复的颜色数组。
 */
export function assignProjectColors(
  existing: (string | null | undefined)[],
  desired: (string | null | undefined)[]
): ProjectColorKey[] {
  const cycle = [...PROJECT_COLOR_KEYS];
  const used = new Set<ProjectColorKey>();
  const counts = new Map<ProjectColorKey, number>();
  for (const c of PROJECT_COLOR_KEYS) counts.set(c, 0);
  existing.forEach((c) => {
    if (isKey(c)) {
      used.add(c);
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
  });

  return desired.map((want) => {
    if (isKey(want) && !used.has(want)) {
      used.add(want);
      counts.set(want, (counts.get(want) ?? 0) + 1);
      return want;
    }
    const next =
      cycle.find((c) => !used.has(c)) ??
      [...counts.entries()].sort((a, b) => a[1] - b[1])[0]?.[0] ??
      "gray";
    used.add(next);
    counts.set(next, (counts.get(next) ?? 0) + 1);
    return next;
  });
}
