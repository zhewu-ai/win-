import { prisma } from "@/lib/prisma";

export const DEFAULT_QUOTA_BYTES = 10 * 1024 * 1024; // 10 MB

export const QUOTA_EXCEEDED_ERROR = "STORAGE_QUOTA_EXCEEDED";
export const QUOTA_EXCEEDED_MESSAGE =
  "存储空间不足，无法上传图片。请删除不需要的图片或便签后再试。";

/** 便签文本占用（UTF-8 字节）：title + content + checklistItems + checklistGroups。
 * checklist 字段在 SQLite 中按 JSON 字符串存储，按存储串计字节。 */
export function noteSizeBytes(note: {
  title?: string | null;
  content?: string | null;
  checklistItems?: string | null;
  checklistGroups?: string | null;
}): number {
  return (
    Buffer.byteLength(note.title ?? "", "utf8") +
    Buffer.byteLength(note.content ?? "", "utf8") +
    Buffer.byteLength(note.checklistItems ?? "[]", "utf8") +
    Buffer.byteLength(note.checklistGroups ?? "[]", "utf8")
  );
}

/** 按便签数据（数组形式的 checklist）估算文本字节数，用于新建前额度检查。 */
export function notePayloadSizeBytes(data: {
  title?: unknown;
  content?: unknown;
  checklistItems?: unknown;
  checklistGroups?: unknown;
}): number {
  return (
    Buffer.byteLength(typeof data.title === "string" ? data.title : "", "utf8") +
    Buffer.byteLength(typeof data.content === "string" ? data.content : "", "utf8") +
    Buffer.byteLength(JSON.stringify(data.checklistItems ?? []), "utf8") +
    Buffer.byteLength(JSON.stringify(data.checklistGroups ?? []), "utf8")
  );
}

/** 增量更新已用空间（delta 可为负）。负值触发下限 0 保护。返回更新后的值。 */
export async function addStorageUsed(
  userId: string,
  delta: number
): Promise<number> {
  if (delta === 0) {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { storageUsedBytes: true },
    });
    return u?.storageUsedBytes ?? 0;
  }
  const u = await prisma.user.update({
    where: { id: userId },
    data: { storageUsedBytes: { increment: delta } },
    select: { storageUsedBytes: true },
  });
  if (u.storageUsedBytes < 0) {
    await prisma.user.update({
      where: { id: userId },
      data: { storageUsedBytes: 0 },
    });
    return 0;
  }
  return u.storageUsedBytes;
}

/** 读取当前用户额度与已用，返回是否可用（true=可用）。 */
export async function getStorageState(userId: string): Promise<{
  quota: number;
  used: number;
  available: boolean;
}> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { storageQuotaBytes: true, storageUsedBytes: true },
  });
  const quota = u?.storageQuotaBytes ?? DEFAULT_QUOTA_BYTES;
  const used = u?.storageUsedBytes ?? 0;
  return { quota, used, available: used < quota };
}

/** 兜底重算：从全部便签（含回收站，口径同 §6.3）与全部附件全量统计。
 * 用于 M10.3 首次上线、以及日后用量异常校正。 */
export async function recalculateStorageUsage(userId: string): Promise<number> {
  const notes = await prisma.note.findMany({
    where: { userId },
    select: {
      title: true,
      content: true,
      checklistItems: true,
      checklistGroups: true,
    },
  });
  const attSum = await prisma.attachment.aggregate({
    where: { userId },
    _sum: { size: true },
  });
  const used =
    notes.reduce((s, n) => s + noteSizeBytes(n), 0) + (attSum._sum.size ?? 0);
  await prisma.user.update({
    where: { id: userId },
    data: { storageUsedBytes: used },
  });
  return used;
}
