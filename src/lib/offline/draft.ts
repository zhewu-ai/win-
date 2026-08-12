import type { ChecklistGroup, ChecklistItem } from "@/types";

/** 未同步内容的本地草稿镜像。localStorage 同步写，
 * 用于 IndexedDB 异步写不可靠的关闭/崩溃场景兜底（防丢保护）。 */
export interface NoteDraft {
  noteId: string;
  title: string;
  content: string;
  mode: "text" | "checklist";
  color: string;
  isPinned: boolean;
  isArchived: boolean;
  checklistItems: ChecklistItem[];
  checklistGroups: ChecklistGroup[];
  /** M16 统一文档：权威 documentJson（旧数据可能为空）。 */
  documentJson?: string | null;
  updatedAt: string;
}

const DRAFT_KEY = "sticky-notes.draft";

/** 同步写草稿。返回是否写入成功。 */
export function saveDraft(d: NoteDraft): boolean {
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    return true;
  } catch {
    return false;
  }
}

export function getDraft(): NoteDraft | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as NoteDraft;
    if (!parsed || typeof parsed.noteId !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

/** 仅当草稿属于该便签时清理，避免误删其它便签的草稿。 */
export function clearDraft(noteId: string): void {
  try {
    const d = getDraft();
    if (d && d.noteId === noteId) {
      window.localStorage.removeItem(DRAFT_KEY);
    }
  } catch {
    // ignore
  }
}
