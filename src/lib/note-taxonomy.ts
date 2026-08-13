import { prisma } from "@/lib/prisma";
import type { PrismaPromise } from "@prisma/client";
import { parseNoteLinks } from "./link-parser";
import { extractTags, TAG_NAME_MAX, TAGS_PER_NOTE_MAX } from "./tag-parser";

type PrismaBatch = PrismaPromise<unknown>;

/** 校验并清洗 tags 入参（手动标签名数组）。非法返回 null，调用方回 400。 */
export function validateTags(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  if (raw.length > TAGS_PER_NOTE_MAX) return null;
  const cleaned: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "string") return null;
    const name = item.trim().slice(0, TAG_NAME_MAX);
    if (!name) return null;
    if (!seen.has(name)) {
      seen.add(name);
      cleaned.push(name);
    }
  }
  return cleaned;
}

interface TagBindingRow {
  tagId: string;
  name: string;
  source: string;
}

/**
 * 让标签绑定回到 desired 状态：auto = 正文 #标签 抽取，manual = 手加名。
 * 核心「自动/手动不互删」：只删 source=auto 且名 ∉ auto 的绑定、source=manual 且名 ∉ manual 的绑定。
 * 对 desired 名逐名 get-or-create NoteTag，再按 source upsert 绑定（@@unique([noteId,tagId,source]) 防重）。
 * 参数为原始文本 + 手动名；返回值含受影响标签 id 列表（供需要时 re-fetch 用），调用方可忽略。
 */
export async function reconcileNoteTags(
  noteId: string,
  userId: string,
  content: string,
  manualNames: string[]
): Promise<string[]> {
  const autoNames = extractTags(content);
  const manualSet = new Set(manualNames);
  const autoSet = new Set(autoNames);
  const desired = [...new Set([...autoNames, ...manualNames])];

  const existing = await prisma.noteTagBinding.findMany({
    where: { noteId, userId },
    include: { tag: { select: { id: true, name: true } } },
  });

  const txn: PrismaBatch[] = [];
  const tagIds: string[] = [];

  for (const row of existing) {
    const b = row as unknown as TagBindingRow & { tag: { id: string; name: string } };
    const name = b.tag.name;
    if (b.source === "auto" && !autoSet.has(name)) txn.push(deleteBinding(b.tagId, noteId, "auto"));
    else if (b.source === "manual" && !manualSet.has(name)) txn.push(deleteBinding(b.tagId, noteId, "manual"));
  }

  for (const name of desired) {
    const tag = await getOrCreateTag(userId, name);
    tagIds.push(tag.id);
    // auto 需要存在；manual 需要存在（同一名字两种 source 各一条，靠 @@unique 区分）
    if (autoSet.has(name)) txn.push(upsertBinding(noteId, tag.id, "auto", userId));
    if (manualSet.has(name)) txn.push(upsertBinding(noteId, tag.id, "manual", userId));
  }

  if (txn.length > 0) {
    await prisma.$transaction(txn);
  }
  return tagIds;
}

function deleteBinding(
  tagId: string,
  noteId: string,
  source: string
): PrismaBatch {
  return prisma.noteTagBinding.deleteMany({
    where: { noteId, tagId, source },
  });
}

function upsertBinding(
  noteId: string,
  tagId: string,
  source: string,
  userId: string
): PrismaBatch {
  return prisma.noteTagBinding.upsert({
    where: {
      noteId_tagId_source: { noteId, tagId, source },
    },
    create: { noteId, tagId, source, userId },
    update: {},
  });
}

async function getOrCreateTag(
  userId: string,
  name: string
): Promise<{ id: string }> {
  const existing = await prisma.noteTag.findFirst({
    where: { userId, name },
    select: { id: true },
  });
  if (existing) return existing;
  return prisma.noteTag.create({
    data: { userId, name },
    select: { id: true },
  });
}

/**
 * 全量重算便签出链：解析 content 里的 [[note:id|title]]，去重、排除自身，
 * 事务内删旧建新。只收 content/documentJson 变化时调用，与 update 同批次副作用。
 */
export async function recomputeNoteLinks(
  noteId: string,
  userId: string,
  content: string
): Promise<void> {
  const targets = new Set<string>();
  for (const seg of parseNoteLinks(content)) {
    if (seg.type === "note" && seg.noteId !== noteId) targets.add(seg.noteId);
  }
  // 先删本便签全部出链，再建新链：targets 已按 Set 去重，事务内无重复可能（@@unique 兜底）。
  await prisma.$transaction([
    prisma.noteLinkEdge.deleteMany({ where: { fromNoteId: noteId, userId } }),
    prisma.noteLinkEdge.createMany({
      data: [...targets].map((toNoteId) => ({
        fromNoteId: noteId,
        toNoteId,
        userId,
      })),
    }),
  ]);
}
