/**
 * 最小内存级频控。单进程内生效，进程重启即清零（本项目生产为单 systemd 服务进程）。
 * key 形如 `forgot:email:<邮箱>` / `forgot:ip:<ip>`。
 */
const store = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const cur = store.get(key);
  if (!cur || now >= cur.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (cur.count >= limit) return false;
  cur.count += 1;
  return true;
}

/** 顺带清理过期条目，避免 Map 无限增长。 */
export function pruneRateLimits(): void {
  const now = Date.now();
  for (const [k, v] of store) {
    if (now >= v.resetAt) store.delete(k);
  }
}
