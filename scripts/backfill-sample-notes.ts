/**
 * 一次性存量补发脚本：给所有 active 用户补发 4 条新用户示例便签（已有示例便签的用户跳过）。
 * 幂等：可重复运行。此次全量推送后，后续仅新注册用户自动生成示例便签。
 * 用法：`DATABASE_URL="file:/abs/path.db" npx tsx scripts/backfill-sample-notes.ts`
 */
import { PrismaClient } from "@prisma/client";
import { createSampleNotes } from "../src/lib/sample-notes";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: { status: "active" },
    select: { id: true, username: true, role: true, storageUsedBytes: true },
    orderBy: { createdAt: "asc" },
  });
  console.log(`目标: ${users.length} 个 active 用户`);
  let done = 0;
  let skipped = 0;
  for (const u of users) {
    const hasSample = await prisma.note.count({
      where: { userId: u.id, isSample: true },
    });
    if (hasSample > 0) {
      console.log(`SKIP ${u.username} (${u.role}): 已有 ${hasSample} 条示例`);
      skipped++;
      continue;
    }
    const bytes = await prisma.$transaction((tx) => createSampleNotes(tx, u.id));
    await prisma.user.update({
      where: { id: u.id },
      data: { storageUsedBytes: { increment: bytes } },
    });
    done++;
    console.log(
      `DONE ${u.username} (${u.role}): +4 条示例 (+${bytes}B, ${u.storageUsedBytes}B → ${u.storageUsedBytes + bytes}B)`
    );
  }
  console.log(`完成: 补发 ${done} 人, 跳过 ${skipped} 人`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
