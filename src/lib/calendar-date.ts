// 日历日期工具：全部按浏览器本地时区处理，避免 UTC 转换导致“今天/明天”错位。

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Date → YYYY-MM-DD（本地）。 */
export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** YYYY-MM-DD → 本地 Date（中午 12 点，规避夏令时/时区边界）。 */
export function fromDateStr(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

export function todayStr(): string {
  return toDateStr(new Date());
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/** 周一起始的周首日。 */
export function startOfWeek(d: Date): Date {
  const r = new Date(d);
  const dow = (r.getDay() + 6) % 7; // Sun=0 → 6, Mon=0
  r.setDate(r.getDate() - dow);
  return r;
}

export function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export function isSameDay(a: Date, b: Date): boolean {
  return toDateStr(a) === toDateStr(b);
}

/** 校验 YYYY-MM-DD 且 from ≤ to（to 可省略，仅校验单个日期）。 */
export function isValidDateRange(from: string, to?: string): boolean {
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (!re.test(from)) return false;
  if (to !== undefined) {
    if (!re.test(to)) return false;
    if (from > to) return false;
  }
  const [y, m, d] = from.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1) return false;
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

/** 友好时间显示：00:00 → "0:00"，09:05 → "9:05"。 */
export function friendlyTime(t: string): string {
  const m = /^(\d{2}):(\d{2})$/.exec(t);
  if (!m) return t;
  return `${parseInt(m[1], 10)}:${m[2]}`;
}

const WEEKDAY_LABELS = ["一", "二", "三", "四", "五", "六", "日"] as const;
export function weekdayLabel(dayIndex: number): string {
  return WEEKDAY_LABELS[dayIndex] ?? "";
}

/** 月份网格：按周一起始排成 6 行 × 7 列（含前后月补位），返回 { date, inMonth }。 */
export function monthGrid(year: number, month: number): { date: Date; inMonth: boolean }[] {
  const first = new Date(year, month, 1);
  const start = startOfWeek(first);
  const cells: { date: Date; inMonth: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = addDays(start, i);
    cells.push({ date: d, inMonth: isSameMonth(d, first) });
  }
  return cells;
}

/** 生成 YYYY-MM 的月份选择列表：以当前月为中心前后 ±2 年。 */
export function monthOptions(center: Date): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  const start = new Date(center.getFullYear() - 2, 0, 1);
  for (let i = 0; i < 24 * 5; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    out.push({
      value: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`,
      label: `${d.getFullYear()} 年 ${d.getMonth() + 1} 月`,
    });
  }
  return out;
}
