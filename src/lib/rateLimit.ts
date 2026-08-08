/**
 * 最小内存级频控。单进程内生效，进程重启即清零（本项目生产为单 systemd 服务进程）。
 * key 形如 `forgot:email:<邮箱>` / `forgot:ip:<ip>`。
 */
const store = new Map<string, { count: number; resetAt: number }>();

// 每次 rateLimit 调用自增，达到阈值时顺带 prune 一次，避免 Map 无限增长
let calls = 0;
const PRUNE_INTERVAL = 128;

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  let allowed: boolean;
  const cur = store.get(key);
  if (!cur || now >= cur.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    allowed = true;
  } else if (cur.count >= limit) {
    allowed = false;
  } else {
    cur.count += 1;
    allowed = true;
  }

  calls += 1;
  if (calls >= PRUNE_INTERVAL) {
    calls = 0;
    pruneRateLimits();
  }
  return allowed;
}

/** 顺带清理过期条目，避免 Map 无限增长。 */
export function pruneRateLimits(): void {
  const now = Date.now();
  for (const [k, v] of store) {
    if (now >= v.resetAt) store.delete(k);
  }
}
