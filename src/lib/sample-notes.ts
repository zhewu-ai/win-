import type { Prisma } from "@prisma/client";
import { textToChecklist } from "@/lib/note-serializer";
import { notePayloadSizeBytes } from "@/lib/storage";

interface SampleNoteInput {
  title: string;
  content: string;
  mode: "text" | "checklist";
  color: string;
}

const SAMPLES: SampleNoteInput[] = [
  {
    title: "欢迎使用 PinNote",
    mode: "text",
    color: "yellow",
    content: [
      "欢迎使用 PinNote",
      "",
      "这里可以记录临时想法、会议摘要、灵感和备忘。",
      "左侧是便签列表，点击新建可以继续添加。",
      "（这是一条示例便签，你可以删除）",
    ].join("\n"),
  },
  {
    title: "今日待办",
    mode: "checklist",
    color: "blue",
    content: [
      "写下今天最重要的 3 件事",
      "完成后勾选",
      "不重要的事情可以归档或删除",
    ].join("\n"),
  },
  {
    title: "使用技巧",
    mode: "text",
    color: "green",
    content: [
      "使用技巧",
      "",
      "你可以：",
      "- 给便签换颜色",
      "- 把重要便签置顶",
      "- 删除后在回收站恢复",
      "- 在电脑网页端下载桌面版",
      "（这是一条示例便签，你可以删除）",
    ].join("\n"),
  },
  {
    title: "x月x日 xx镜头反馈（新用户引导案例）",
    mode: "checklist",
    color: "yellow",
    content: [
      "# c4d中修改",
      "背板太黄",
      "deco小碎光太多",
      "屏幕适当补一些光",
      "deco上pos太强",
      "# ae中修改",
      "背板纹理减弱",
      "cd光比太大",
    ].join("\n"),
  },
];

/** 为新注册用户生成 4 条示例便签（仅注册时调用一次），返回所占存储字节数。 */
export async function createSampleNotes(
  tx: Prisma.TransactionClient,
  userId: string
): Promise<number> {
  const baseSortOrder = Math.floor(Date.now() / 1000);
  let totalBytes = 0;

  for (let i = 0; i < SAMPLES.length; i++) {
    const s = SAMPLES[i];
    const items = s.mode === "checklist" ? textToChecklist(s.content).items : [];
    const bytes = notePayloadSizeBytes({
      title: s.title,
      content: s.mode === "checklist" ? "" : s.content,
      checklistItems: items.length > 0 ? items : undefined,
    });
    totalBytes += bytes;

    await tx.note.create({
      data: {
        userId,
        title: s.title,
        content: s.mode === "checklist" ? "" : s.content,
        color: s.color,
        mode: s.mode,
        checklistItems: JSON.stringify(items),
        isSample: true,
        sortOrder: baseSortOrder - (SAMPLES.length - i),
      },
    });
  }

  return totalBytes;
}
