import Dexie, { type Table } from "dexie";
import type {
  Attachment,
  ChecklistGroup,
  ChecklistItem,
  NoteColor,
  SyncStatus,
} from "@/types";

export interface LocalNote {
  localId: string;
  serverId: string | null;
  userId: string;
  title: string;
  content: string;
  color: NoteColor;
  isPinned: boolean;
  isArchived: boolean;
  mode: "text" | "checklist";
  checklistItems: ChecklistItem[];
  checklistGroups: ChecklistGroup[];
  /** M16 统一文档：权威 documentJson（旧数据可能为空）。 */
  documentJson?: string | null;
  attachments: Attachment[];
  sortOrder: number;
  windowX: number | null;
  windowY: number | null;
  windowWidth: number | null;
  windowHeight: number | null;
  alwaysOnTop: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  syncStatus: SyncStatus;
  lastSyncedAt: string | null;
  lastLocalEditAt: string;
}

class OfflineDB extends Dexie {
  notes!: Table<LocalNote, string>;

  constructor() {
    super("sticky-notes-offline");
    this.version(1).stores({
      notes: "localId, serverId, updatedAt, isPinned, syncStatus, deletedAt",
    });
  }
}

// 懒初始化：避免在 SSR/Node 环境（无 indexedDB）模块加载即崩溃；
// 所有读写都发生在浏览器运行时。
let _db: OfflineDB | null = null;
export function getDB(): OfflineDB {
  if (typeof indexedDB === "undefined") {
    throw new Error("IndexedDB not available");
  }
  if (!_db) _db = new OfflineDB();
  return _db;
}

export async function listNotes(): Promise<LocalNote[]> {
  return getDB().notes.toArray();
}

export async function getNote(id: string): Promise<LocalNote | undefined> {
  return getDB().notes.get(id);
}

export async function getNoteByServerId(
  serverId: string
): Promise<LocalNote | undefined> {
  return getDB().notes.where("serverId").equals(serverId).first();
}

export async function putNote(note: LocalNote): Promise<string> {
  return getDB().notes.put(note);
}

export async function bulkPutNotes(notes: LocalNote[]): Promise<void> {
  if (notes.length === 0) return;
  await getDB().notes.bulkPut(notes);
}

export async function deleteNoteRow(id: string): Promise<void> {
  await getDB().notes.delete(id);
}

export async function clearAll(): Promise<void> {
  await getDB().notes.clear();
}
