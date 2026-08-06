import type { Note, NoteColor, SyncStatus } from "@/types";
import type { LocalNote } from "./db";
import {
  deleteNoteRow,
  getNote,
  getNoteByServerId,
  listNotes,
  putNote,
} from "./db";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function isNetworkError(e: unknown): boolean {
  return (
    e instanceof TypeError ||
    (e instanceof Error && e.name === "AbortError")
  );
}

/** 带超时的 fetch：断网黑洞/服务器无响应时 ~8s 后以 AbortError 结束，
 * 走调用方的 isNetworkError 本地降级路径，避免保存请求无限挂起。 */
const FETCH_TIMEOUT_MS = 8000;

export function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs = FETCH_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(input, { ...init, signal: controller.signal }).finally(() =>
    clearTimeout(timer)
  );
}

function now(): string {
  return new Date().toISOString();
}

export function mapToLocal(note: Note, status: SyncStatus = "synced"): LocalNote {
  return {
    localId: note.id,
    serverId: note.id,
    userId: note.userId,
    title: note.title,
    content: note.content,
    color: note.color,
    isPinned: note.isPinned,
    isArchived: note.isArchived,
    mode: note.mode,
    checklistItems: note.checklistItems || [],
    checklistGroups: note.checklistGroups || [],
    attachments: note.attachments || [],
    sortOrder: note.sortOrder,
    windowX: note.windowX,
    windowY: note.windowY,
    windowWidth: note.windowWidth,
    windowHeight: note.windowHeight,
    alwaysOnTop: note.alwaysOnTop,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    deletedAt: note.deletedAt,
    syncStatus: status,
    lastSyncedAt: status === "synced" ? now() : null,
    lastLocalEditAt: now(),
  };
}

export function mapFromLocal(local: LocalNote): Note {
  return {
    id: local.localId,
    syncStatus: local.syncStatus,
    userId: local.userId,
    title: local.title,
    content: local.content,
    color: local.color,
    isPinned: local.isPinned,
    isArchived: local.isArchived,
    mode: local.mode,
    checklistItems: local.checklistItems || [],
    checklistGroups: local.checklistGroups || [],
    sortOrder: local.sortOrder,
    windowX: local.windowX,
    windowY: local.windowY,
    windowWidth: local.windowWidth,
    windowHeight: local.windowHeight,
    alwaysOnTop: local.alwaysOnTop,
    createdAt: local.createdAt,
    updatedAt: local.updatedAt,
    deletedAt: local.deletedAt,
    attachments: local.attachments,
  };
}

/** 在线成功获取便签后镜像到本地（synced）。
 * 若本地已有待同步修改（pending 状态/syncError），不覆盖，避免服务端快照吞掉离线编辑。 */
export async function mirrorNote(note: Note): Promise<void> {
  const existing = await getNote(note.id);
  if (existing && existing.syncStatus !== "synced") return;
  await putNote(mapToLocal(note, "synced"));
}

/** 把一次 PATCH 增量合并进本地缓存，标记待同步。返回合并后的本地记录。 */
async function applyLocalUpdate(
  id: string,
  updates: Record<string, unknown>
): Promise<LocalNote> {
  const t = now();
  let local = await getNote(id);
  if (!local) {
    local = {
      localId: id,
      serverId: id,
      userId: "",
      title: "",
      content: "",
      color: "yellow",
      isPinned: false,
      isArchived: false,
      mode: "text",
      checklistItems: [],
      checklistGroups: [],
      attachments: [],
      sortOrder: Math.floor(Date.now() / 1000),
      windowX: null,
      windowY: null,
      windowWidth: null,
      windowHeight: null,
      alwaysOnTop: false,
      createdAt: t,
      updatedAt: t,
      deletedAt: null,
      syncStatus: "pendingUpdate",
      lastSyncedAt: null,
      lastLocalEditAt: t,
    };
  }
  const merged: LocalNote = {
    ...local,
    ...(updates as unknown as Partial<LocalNote>),
    updatedAt: t,
    lastLocalEditAt: t,
    syncStatus:
      local.syncStatus === "pendingCreate" ? "pendingCreate" : "pendingUpdate",
  };
  await putNote(merged);
  return merged;
}

/** 保存便签更新：在线走 PATCH + 镜像；网络失败/离线写本地（pending）。返回最新 Note。 */
export async function saveNoteUpdate(
  id: string,
  updates: Record<string, unknown>
): Promise<Note> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return mapFromLocal(await applyLocalUpdate(id, updates));
  }
  try {
    const res = await fetchWithTimeout(`/api/notes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (res.status === 401) throw new ApiError(401, "Unauthorized");
    if (res.status >= 500) {
      // 服务器 5xx：不丢输入，转本地待同步（防丢保护触发条件）
      return mapFromLocal(await applyLocalUpdate(id, updates));
    }
    if (!res.ok) throw new ApiError(res.status, "Save failed");
    const updated: Note = await res.json();
    await mirrorNote(updated);
    return updated;
  } catch (e) {
    if (isNetworkError(e)) {
      return mapFromLocal(await applyLocalUpdate(id, updates));
    }
    throw e;
  }
}

/** 在线创建 + 镜像。调用方负责把结果插入内存列表。 */
export async function createNoteRemote(data?: Partial<Note>): Promise<Note> {
  const res = await fetchWithTimeout("/api/notes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      data || { title: "", content: "", color: "yellow" }
    ),
  });
  if (res.status === 401) throw new ApiError(401, "Unauthorized");
  if (!res.ok) throw new ApiError(res.status, "Create failed");
  const note: Note = await res.json();
  await mirrorNote(note);
  return note;
}

/** 离线新建：本地 UUID 为 id，pendingCreate。 */
export async function createNoteLocal(data?: Partial<Note>): Promise<Note> {
  const t = now();
  const local: LocalNote = {
    localId: crypto.randomUUID(),
    serverId: null,
    userId: "",
    title: data?.title ?? "",
    content: data?.content ?? "",
    color: (data?.color as NoteColor) ?? "yellow",
    isPinned: data?.isPinned ?? false,
    isArchived: data?.isArchived ?? false,
    mode: data?.mode ?? "text",
    checklistItems: data?.checklistItems ?? [],
    checklistGroups: data?.checklistGroups ?? [],
    attachments: [],
    sortOrder: Math.floor(Date.now() / 1000),
    windowX: null,
    windowY: null,
    windowWidth: null,
    windowHeight: null,
    alwaysOnTop: false,
    createdAt: t,
    updatedAt: t,
    deletedAt: null,
    syncStatus: "pendingCreate",
    lastSyncedAt: null,
    lastLocalEditAt: t,
  };
  await putNote(local);
  return mapFromLocal(local);
}

/** 删除：在线 DELETE + 移除本地；离线/网络失败按 7.5 语义处理。 */
export async function deleteNoteOfflineAware(id: string): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.onLine) {
    try {
      const res = await fetchWithTimeout(`/api/notes/${id}`, { method: "DELETE" });
      if (res.status === 401) throw new ApiError(401, "Unauthorized");
      if (!res.ok) throw new ApiError(res.status, "Delete failed");
      await deleteNoteRow(id);
      return;
    } catch (e) {
      if (isNetworkError(e)) {
        // 落到下方离线删除逻辑
      } else {
        throw e;
      }
    }
  }
  // 离线：未同步便签直接移除；已同步便签标记 pendingDelete
  const local = await getNote(id);
  if (!local || local.serverId === null) {
    await deleteNoteRow(id);
    return;
  }
  const t = now();
  await putNote({
    ...local,
    deletedAt: t,
    updatedAt: t,
    lastLocalEditAt: t,
    syncStatus: "pendingDelete",
  });
}

/** 离线启动/网络失败时从本地加载便签列表（排除已删除）。 */
export async function loadCachedNotes(): Promise<Note[]> {
  const locals = await listNotes();
  return locals
    .filter((l) => l.deletedAt === null)
    .sort(
      (a, b) =>
        Number(b.isPinned) - Number(a.isPinned) ||
        b.updatedAt.localeCompare(a.updatedAt)
    )
    .map(mapFromLocal);
}

/** 读取单条本地便签（浮窗离线打开用）。 */
export async function getCachedNote(id: string): Promise<Note | null> {
  const local = await getNote(id);
  if (!local || local.deletedAt !== null) return null;
  return mapFromLocal(local);
}

/** 以 serverId 查本地便签（同步回填校验用）。 */
export async function getCachedNoteByServerId(
  serverId: string
): Promise<Note | null> {
  const local = await getNoteByServerId(serverId);
  if (!local || local.deletedAt !== null) return null;
  return mapFromLocal(local);
}
