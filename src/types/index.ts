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

export type SyncStatus =
  | "synced"
  | "pendingCreate"
  | "pendingUpdate"
  | "pendingDelete"
  | "syncError";

export interface Note {
  id: string;
  userId: string;
  /** 本地同步状态；服务端返回的便签无此字段（等价 synced）。仅离线层写入。 */
  syncStatus?: SyncStatus;
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
  email?: string | null;
  displayName?: string | null;
  avatarColor?: string | null;
  avatarUrl?: string | null;
  avatarMimeType?: string | null;
  avatarSize?: number;
  storageQuotaBytes?: number;
  storageUsedBytes?: number;
  role?: "admin" | "user";
  status?: "active" | "disabled";
  mustChangePassword?: boolean;
}

export interface AdminInvite {
  id: string;
  status: "active" | "revoked" | "used" | "expired";
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
  usedBy?: { id: string; username: string; displayName: string | null; email: string | null } | null;
}

export type FeedbackType = "bug" | "feature" | "other";
export type FeedbackStatus = "open" | "reviewing" | "resolved" | "closed";

export interface FeedbackTicket {
  id: string;
  type: FeedbackType;
  title: string;
  content: string;
  status: FeedbackStatus;
  pageUrl: string | null;
  userAgent: string | null;
  appVersion: string | null;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    username: string;
    email: string | null;
    displayName: string | null;
  };
}
