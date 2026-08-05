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
