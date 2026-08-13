import { prisma } from "@/lib/prisma";

export type UserActivityAction =
  | "login"
  | "create_note"
  | "edit_note"
  | "check_todo"
  | "delete_note"
  | "restore_note"
  | "archive_note"
  | "unarchive_note"
  | "permanent_delete_note"
  | "upload_attachment"
  | "delete_attachment"
  | "submit_feedback"
  | "read_announcement"
  | "change_avatar"
  | "change_password"
  | "create_folder"
  | "rename_folder"
  | "delete_folder"
  | "move_note"
  | "create_tag"
  | "delete_tag";

/** Asia/Shanghai 固定 UTC+8，无夏令时。 */
const CST_OFFSET_MIN = 8 * 60;

/** 上海自然日零点（返回 UTC 绝对时刻），与服务器进程 TZ 无关。 */
export function cstDayStartUTC(now = new Date()): Date {
  const wall = new Date(
    now.getTime() + (now.getTimezoneOffset() + CST_OFFSET_MIN) * 60000
  );
  const midnight = Date.UTC(
    wall.getUTCFullYear(),
    wall.getUTCMonth(),
    wall.getUTCDate()
  );
  return new Date(midnight - CST_OFFSET_MIN * 60000);
}

/**
 * 记录一次用户活跃：更新 User.lastActiveAt/lastActiveAction + 插入一条 UserActivityLog。
 * 失败只 console.error，绝不抛出、绝不影响主业务接口成功率。
 * metadata 仅允许 {count} / {type} / {noteMode} 等非内容字段；
 * 禁止便签标题/正文/待办文字/反馈正文/附件原始文件名。
 */
export async function recordUserActivity(
  userId: string,
  action: UserActivityAction,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    let metaJson: string | undefined;
    if (metadata !== undefined) {
      try {
        metaJson = JSON.stringify(metadata);
      } catch {
        metaJson = undefined;
      }
    }
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { lastActiveAt: new Date(), lastActiveAction: action },
      }),
      prisma.userActivityLog.create({
        data: { userId, action, metadata: metaJson },
      }),
    ]);
  } catch (e) {
    // 活跃记录失败不阻塞主业务
    console.error("[activity] recordUserActivity failed:", action, userId, e);
  }
}
