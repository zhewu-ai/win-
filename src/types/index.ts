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

export type CalendarEventStatus = "todo" | "done" | "postponed";

export interface CalendarEvent {
  id: string;
  noteId: string | null;
  title: string;
  description: string;
  /** YYYY-MM-DD，按本地日期存储 */
  date: string;
  /** HH:mm，全天事件为 null */
  startTime: string | null;
  endTime: string | null;
  allDay: boolean;
  status: CalendarEventStatus;
  source: string;
  createdAt: string;
  updatedAt: string;
  note: {
    id: string;
    title: string;
    isArchived: boolean;
    isTrashed: boolean;
  } | null;
}

export interface CalendarEventInput {
  title: string;
  description?: string;
  date: string;
  allDay?: boolean;
  startTime?: string | null;
  endTime?: string | null;
  status?: CalendarEventStatus;
  noteId?: string | null;
}

// M12 工作日历人工闭环：项目 + 排期条目
export type WorkProjectColor = "blue" | "red" | "green" | "purple" | "gray";
export type WorkProjectStatus = "active" | "archived";
export type WorkScheduleItemType = "range" | "node";

export interface WorkProject {
  id: string;
  name: string;
  colorKey: WorkProjectColor;
  status: WorkProjectStatus;
  /** YYYY-MM-DD，可空 */
  startDate: string | null;
  endDate: string | null;
  description: string;
  source: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface WorkProjectInput {
  name: string;
  colorKey: WorkProjectColor;
  startDate?: string | null;
  endDate?: string | null;
  description?: string;
}

export interface WorkScheduleItem {
  id: string;
  projectId: string;
  title: string;
  type: WorkScheduleItemType;
  /** YYYY-MM-DD；node 与 startDate 相同 */
  startDate: string;
  endDate: string;
  status: CalendarEventStatus;
  noteId: string | null;
  source: string;
  createdAt: string;
  updatedAt: string;
  note?: {
    id: string;
    title: string;
    isArchived: boolean;
    isTrashed: boolean;
  } | null;
}

export interface WorkScheduleItemInput {
  projectId: string;
  title: string;
  type: WorkScheduleItemType;
  startDate: string;
  endDate: string;
  status?: CalendarEventStatus;
  noteId?: string | null;
}

export interface QuickWeekDayInput {
  mon?: string;
  tue?: string;
  wed?: string;
  thu?: string;
  fri?: string;
  sat?: string;
  sun?: string;
}

export interface QuickWeekNodeInput {
  date: string;
  title: string;
}

/** quick-week 接口返回的生成预览（不直接保存）。 */
export interface QuickWeekPreviewRow {
  title: string;
  type: WorkScheduleItemType;
  startDate: string;
  endDate: string;
}
