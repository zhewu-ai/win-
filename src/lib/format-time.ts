export const TRASH_RETENTION_DAYS = 7;

export function formatNoteTime(dateStr: string, now = new Date()): string {
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const mins = Math.floor(diffMs / 60000);

  if (mins < 1) return "刚刚";
  if (mins < 60) return `${mins}分钟前`;

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDay = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );
  const diffDays = Math.round(
    (startOfToday.getTime() - startOfDay.getTime()) / 86400000
  );

  const pad = (n: number) => String(n).padStart(2, "0");
  const hhmm = `${pad(date.getHours())}:${pad(date.getMinutes())}`;

  if (diffDays === 0) return `今天 ${hhmm}`;
  if (diffDays === 1) return `昨天 ${hhmm}`;
  if (diffDays > 1 && diffDays <= 7) {
    const week = "日一二三四五六"[date.getDay()];
    return `周${week} ${hhmm}`;
  }
  if (date.getFullYear() !== now.getFullYear()) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
      date.getDate()
    )}`;
  }
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${hhmm}`;
}

/** 删除日期，如「8月6日」，跨年带年份。 */
export function formatDeletedDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const md = `${d.getMonth() + 1}月${d.getDate()}日`;
  if (d.getFullYear() !== now.getFullYear()) return `${d.getFullYear()}年${md}`;
  return md;
}

/** 回收站剩余保留时间：满 7 天自动永久删除。 */
export function formatTrashRetention(
  deletedAt: string,
  now = new Date()
): string {
  const d = new Date(deletedAt);
  if (isNaN(d.getTime())) return "";
  const expireAt = d.getTime() + TRASH_RETENTION_DAYS * 24 * 3600 * 1000;
  const daysLeft = Math.ceil((expireAt - now.getTime()) / 86400000);
  if (daysLeft <= 0) return "今天将永久删除";
  return `${daysLeft}天后永久删除`;
}

/** 最近活跃时间：null→"暂无"；今天 HH:mm / 昨天 HH:mm / 更早 YYYY-MM-DD HH:mm。 */
export function formatLastActiveAt(
  iso: string | null,
  now = new Date()
): string {
  if (!iso) return "暂无";
  const date = new Date(iso);
  if (isNaN(date.getTime())) return "暂无";

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDay = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );
  const diffDays = Math.round(
    (startOfToday.getTime() - startOfDay.getTime()) / 86400000
  );

  const pad = (n: number) => String(n).padStart(2, "0");
  const hhmm = `${pad(date.getHours())}:${pad(date.getMinutes())}`;

  if (diffDays === 0) return `今天 ${hhmm}`;
  if (diffDays === 1) return `昨天 ${hhmm}`;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )} ${hhmm}`;
}
