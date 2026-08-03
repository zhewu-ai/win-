export interface ChecklistItem {
  id: string;
  /** "heading" = 轻量小标题行（无勾选框）；缺省视为 "todo" */
  kind?: "todo" | "heading";
  text: string;
  checked: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  groupId?: string;
  completedAt?: string | null;
}

export interface ChecklistGroup {
  id: string;
  title: string;
  sortOrder: number;
  collapsedCompleted?: boolean;
}

export interface Attachment {
  id: string;
  noteId: string;
  type: string;
  url: string;
  filename: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  createdAt: string;
}

export interface Note {
  id: string;
  userId: string;
  title: string;
  content: string;
  color: NoteColor;
  isPinned: boolean;
  isArchived: boolean;
  mode: "text" | "checklist";
  checklistItems: ChecklistItem[];
  checklistGroups: ChecklistGroup[];
  sortOrder: number;
  windowX: number | null;
  windowY: number | null;
  windowWidth: number | null;
  windowHeight: number | null;
  alwaysOnTop: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  attachments?: Attachment[];
}

export type NoteColor = "yellow" | "blue" | "green" | "pink" | "gray";

export interface User {
  id: string;
  username: string;
}
