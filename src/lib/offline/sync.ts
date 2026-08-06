import type { LocalNote } from "./db";
import { getDB, putNote } from "./db";
import { ApiError, isNetworkError } from "./persist";

const PATCH_FIELDS = [
  "title",
  "content",
  "color",
  "isPinned",
  "isArchived",
  "mode",
  "checklistItems",
  "checklistGroups",
  "sortOrder",
] as const;

// 同步运行状态：单例，多组件挂载共用
let _syncing = false;
const syncStateListeners = new Set<(v: boolean) => void>();

export function onSyncStateChange(fn: (v: boolean) => void): () => void {
  syncStateListeners.add(fn);
  return () => {
    syncStateListeners.delete(fn);
  };
}

function setSyncing(v: boolean) {
  if (_syncing === v) return;
  _syncing = v;
  syncStateListeners.forEach((fn) => fn(v));
}

function patchBody(local: LocalNote): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const field of PATCH_FIELDS) {
    if (local[field] !== undefined) body[field] = local[field];
  }
  return body;
}

async function patchNote(
  serverId: string,
  body: Record<string, unknown>
): Promise<Response> {
  return fetch(`/api/notes/${serverId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** pendingCreate：POST 建服务端记录 → 再 PATCH 补 POST 不接受的字段 → 回填 serverId。 */
async function syncCreate(local: LocalNote): Promise<boolean> {
  const res = await fetch("/api/notes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: local.title,
      content: local.content,
      color: local.color,
      mode: local.mode,
      isPinned: local.isPinned,
      checklistItems: local.checklistItems,
    }),
  });
  if (res.status === 401) throw new ApiError(401, "Unauthorized");
  if (!res.ok) throw new ApiError(res.status, "Sync create failed");
  const created = await res.json();

  // POST 不收 isArchived/checklistGroups/sortOrder，用 PATCH 补齐
  const patchRes = await patchNote(created.id, {
    isArchived: local.isArchived,
    checklistGroups: local.checklistGroups,
    sortOrder: local.sortOrder,
  });
  if (patchRes.status === 401) throw new ApiError(401, "Unauthorized");
  if (!patchRes.ok) throw new ApiError(patchRes.status, "Sync create patch failed");

  local.serverId = created.id;
  local.syncStatus = "synced";
  local.lastSyncedAt = new Date().toISOString();
  await putNote(local);
  return true;
}

/** pendingUpdate / syncError-with-serverId：PATCH 全量本地快照。 */
async function syncUpdate(local: LocalNote): Promise<boolean> {
  if (!local.serverId) return false;
  const res = await patchNote(local.serverId, patchBody(local));
  if (res.status === 401) throw new ApiError(401, "Unauthorized");
  if (!res.ok) throw new ApiError(res.status, "Sync update failed");

  local.syncStatus = "synced";
  local.lastSyncedAt = new Date().toISOString();
  await putNote(local);
  return true;
}

/** pendingDelete：DELETE 服务端（回收站），成功后移除本地。 */
async function syncDelete(local: LocalNote): Promise<boolean> {
  if (!local.serverId) {
    await getDB().notes.delete(local.localId);
    return true;
  }
  const res = await fetch(`/api/notes/${local.serverId}`, { method: "DELETE" });
  if (res.status === 401) throw new ApiError(401, "Unauthorized");
  if (!res.ok) throw new ApiError(res.status, "Sync delete failed");
  await getDB().notes.delete(local.localId);
  return true;
}

/** 标记单条同步失败（不阻塞其它）。 */
async function markError(local: LocalNote) {
  local.syncStatus = "syncError";
  await putNote(local);
}

export async function runSync(): Promise<void> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  if (_syncing) return;
  setSyncing(true);
  try {
    const pending = await getDB()
      .notes.where("syncStatus")
      .anyOf(["pendingCreate", "pendingUpdate", "pendingDelete", "syncError"])
      .toArray();

    // 顺序：create → update → delete；syncError 按是否有 serverId 决定走 create 还是 update
    const ordered = pending.sort((a, b) => {
      const rank: Record<string, number> = {
        pendingCreate: 0,
        syncError: 1,
        pendingUpdate: 2,
        pendingDelete: 3,
      };
      return rank[a.syncStatus] - rank[b.syncStatus];
    });

    for (const local of ordered) {
      try {
        if (local.syncStatus === "pendingCreate") {
          if (local.serverId) await syncUpdate(local);
          else await syncCreate(local);
        } else if (local.syncStatus === "pendingUpdate") {
          await syncUpdate(local);
        } else if (local.syncStatus === "pendingDelete") {
          await syncDelete(local);
        } else {
          // syncError 重试
          if (local.serverId) await syncUpdate(local);
          else await syncCreate(local);
        }
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          // 会话失效，停止本轮，避免循环 401
          throw e;
        }
        if (isNetworkError(e)) {
          // 同步途中断网：整轮停止，等下次 online 事件再试
          return;
        }
        await markError(local);
      }
    }
  } finally {
    setSyncing(false);
  }
}
