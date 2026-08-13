import { prisma } from "@/lib/prisma";
import path from "path";
import fs from "fs/promises";
import { addStorageUsed, noteSizeBytes } from "@/lib/storage";

/**
 * 永久删除指定用户的已删除便签（复用单条永久删除的安全逻辑）：
 * 删 Note → 删 Attachment 记录 → 删附件文件与目录 → 释放 storageUsedBytes。
 * 只操作 userId 名下且 deletedAt 非空的便签，不泄漏他人数据、不留下孤儿文件。
 */
export async function hardDeleteNotes(
  userId: string,
  ids: string[]
): Promise<{ deletedIds: string[]; notFoundIds: string[] }> {
  const uniqueIds = Array.from(new Set(ids));
  const notes = await prisma.note.findMany({
    where: {
      id: { in: uniqueIds },
      userId,
      deletedAt: { not: null },
    },
    include: { attachments: true },
  });

  const ownedIds = notes.map((n) => n.id);
  const ownedSet = new Set(ownedIds);
  const notFoundIds = uniqueIds.filter((id) => !ownedSet.has(id));
  if (ownedIds.length === 0) {
    return { deletedIds: [], notFoundIds };
  }

  const uploadDir = process.env.UPLOAD_DIR || "./uploads";

  for (const note of notes) {
    for (const att of note.attachments) {
      const filePath = path.resolve(uploadDir, att.storagePath);
      try {
        await fs.unlink(filePath);
      } catch {
        // 文件可能已缺失，继续清理
      }
    }
    const noteDir = path.resolve(uploadDir, "notes", note.id);
    try {
      await fs.rm(noteDir, { recursive: true, force: true });
    } catch {
      // 目录可能不存在，继续
    }
  }

  await prisma.attachment.deleteMany({ where: { noteId: { in: ownedIds } } });
  // 标签绑定/出链/反链同批清掉（SQLite 外键级联兜底，显式删除更稳）
  await prisma.noteTagBinding.deleteMany({ where: { noteId: { in: ownedIds } } });
  await prisma.noteLinkEdge.deleteMany({
    where: {
      OR: [
        { fromNoteId: { in: ownedIds } },
        { toNoteId: { in: ownedIds } },
      ],
    },
  });
  await prisma.note.deleteMany({ where: { id: { in: ownedIds } } });

  // 释放空间：便签文本 + 附件
  const released = notes.reduce(
    (s, n) =>
      s + noteSizeBytes(n) + n.attachments.reduce((a, att) => a + att.size, 0),
    0
  );
  await addStorageUsed(userId, -released);

  return { deletedIds: ownedIds, notFoundIds };
}
