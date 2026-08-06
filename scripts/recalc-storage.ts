/**
 * 存储用量兜底重算脚本（M10.3）。
 * 用法：cd 到项目根目录后 `tsx scripts/recalc-storage.ts`
 * 对全部用户重算 storageUsedBytes（文本 UTF-8 字节 + 附件 size，含回收站），并打印前后对比。
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function size(parts: (string | null | undefined)[]): number {
  return parts.reduce(
    (sum, p) => sum + Buffer.byteLength(p ?? "", "utf8"),
    0
  );
}

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      storageQuotaBytes: true,
      storageUsedBytes: true,
    },
  });

  for (const u of users) {
    const notes = await prisma.note.findMany({
      where: { userId: u.id },
      select: {
        title: true,
        content: true,
        checklistItems: true,
        checklistGroups: true,
      },
    });
    const att = await prisma.attachment.aggregate({
      where: { userId: u.id },
      _sum: { size: true },
    });

    const textBytes = notes.reduce(
      (s, n) => s + size([n.title, n.content, n.checklistItems, n.checklistGroups]),
      0
    );
    const attBytes = att._sum.size ?? 0;
    const used = textBytes + attBytes;

    await prisma.user.update({
      where: { id: u.id },
      data: { storageUsedBytes: used },
    });

    console.log(
      `${u.username}: used=${used} (text=${textBytes} att=${attBytes}) quota=${u.storageQuotaBytes} prev=${u.storageUsedBytes}`
    );
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
