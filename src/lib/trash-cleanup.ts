import { prisma } from "@/lib/prisma";
import { TRASH_RETENTION_DAYS } from "@/lib/format-time";
import path from "path";
import fs from "fs/promises";
import { addStorageUsed, noteSizeBytes } from "@/lib/storage";

/** Resolve a storage path strictly inside uploadDir; null if it escapes. */
function safeResolve(uploadDir: string, rel: string): string | null {
  const root = path.resolve(uploadDir);
  const resolved = path.resolve(root, rel);
  const relCheck = path.relative(root, resolved);
  if (relCheck.startsWith("..") || path.isAbsolute(relCheck)) return null;
  return resolved;
}

let lastRunAt = 0;
const THROTTLE_MS = 60 * 60 * 1000;

/**
 * Permanently delete trash notes whose deletedAt is older than the retention
 * window. Removes attachment files (inside uploadDir only) and DB rows, then
 * hard-deletes the note. Returns the number of notes purged.
 *
 * `force` bypasses the one-hour throttle (used by the daily cleanup task).
 */
export async function runTrashCleanup(force = false): Promise<number> {
  const nowMs = Date.now();
  if (!force && nowMs - lastRunAt < THROTTLE_MS) return 0;
  lastRunAt = nowMs;

  const cutoff = new Date(nowMs - TRASH_RETENTION_DAYS * 24 * 3600 * 1000);
  const expired = await prisma.note.findMany({
    where: { deletedAt: { not: null, lt: cutoff } },
    include: { attachments: true },
  });

  const uploadDir = process.env.UPLOAD_DIR || "./uploads";
  let purged = 0;
  for (const note of expired) {
    try {
      for (const att of note.attachments) {
        const fp = safeResolve(uploadDir, att.storagePath);
        if (fp) {
          try {
            await fs.unlink(fp);
          } catch {
            // File may be missing — continue cleanup
          }
        }
      }
      const noteDir = safeResolve(uploadDir, path.join("notes", note.id));
      if (noteDir) {
        try {
          await fs.rm(noteDir, { recursive: true, force: true });
        } catch {
          // Directory may not exist — proceed
        }
      }
      await prisma.attachment.deleteMany({ where: { noteId: note.id } });
      await prisma.note.delete({ where: { id: note.id } });
      // 回收站自动清理 = 永久删除，释放空间（便签文本 + 附件）
      const released =
        noteSizeBytes(note) +
        note.attachments.reduce((s, att) => s + att.size, 0);
      await addStorageUsed(note.userId, -released);
      purged++;
      console.log(
        `[trash-cleanup] purged expired note ${note.id} (deletedAt ${note.deletedAt})`
      );
    } catch (e) {
      console.error(`[trash-cleanup] failed to purge note ${note.id}:`, e);
    }
  }

  if (expired.length > 0) {
    console.log(
      `[trash-cleanup] done: ${purged}/${expired.length} expired notes purged`
    );
  }
  return purged;
}
