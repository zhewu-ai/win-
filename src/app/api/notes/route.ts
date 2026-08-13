import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authOrResponse } from "@/lib/auth";
import {
  serializeNote,
  validateChecklistItems,
  validateNoteTextFields,
} from "@/lib/note-serializer";
import { recordUserActivity } from "@/lib/activity";
import {
  recomputeNoteLinks,
  reconcileNoteTags,
  validateTags,
} from "@/lib/note-taxonomy";
import {
  QUOTA_EXCEEDED_ERROR,
  QUOTA_EXCEEDED_MESSAGE,
  addStorageUsed,
  getStorageState,
  notePayloadSizeBytes,
} from "@/lib/storage";

const VALID_COLORS = ["yellow", "blue", "green", "pink", "gray"];
const SEARCH_MAX_LEN = 100;

export async function GET(request: Request) {
  try {
    const session = await authOrResponse();
    if (session instanceof NextResponse) return session;

    const { searchParams } = new URL(request.url);
    const archivedParam = searchParams.get("archived");
    const isArchived = archivedParam ? archivedParam === "true" : false;
    const q = (searchParams.get("q") || "").slice(0, SEARCH_MAX_LEN);
    const folderParam = searchParams.get("folderId");
    const tagParam = searchParams.get("tag");

    const where: Record<string, unknown> = {
      userId: session.userId,
      deletedAt: null,
      isArchived,
    };

    if (folderParam) {
      // "none" = 未分组；其他必须是当前用户未删除文件夹
      if (folderParam === "none") {
        where.folderId = null;
      } else {
        const folder = await prisma.noteFolder.findFirst({
          where: { id: folderParam, userId: session.userId, deletedAt: null },
        });
        if (!folder) {
          return NextResponse.json(
            { ok: false, error: "INVALID_FOLDER_ID" },
            { status: 400 }
          );
        }
        where.folderId = folderParam;
      }
    }

    if (tagParam) {
      const tag = await prisma.noteTag.findFirst({
        where: { id: tagParam, userId: session.userId },
      });
      if (!tag) {
        return NextResponse.json(
          { ok: false, error: "INVALID_TAG_ID" },
          { status: 400 }
        );
      }
      where.tagBindings = { some: { tagId: tagParam, userId: session.userId } };
    }

    if (q) {
      where.OR = [
        { title: { contains: q } },
        { content: { contains: q } },
        { checklistItems: { contains: q } },
      ];
    }

    const notes = await prisma.note.findMany({
      where,
      include: { attachments: true, tagBindings: { include: { tag: true } } },
      orderBy: [
        { isPinned: "desc" },
        { updatedAt: "desc" },
      ],
    });

    return NextResponse.json({
      notes: notes.map((n) => serializeNote(n as unknown as Record<string, unknown>)),
    });
  } catch (e) {
    console.error("GET /api/notes error:", e);
    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await authOrResponse();
    if (session instanceof NextResponse) return session;

    const body = await request.json();
    const color = body.color || "yellow";
    const mode = body.mode || "text";

    if (!VALID_COLORS.includes(color)) {
      return NextResponse.json(
        { ok: false, error: "INVALID_COLOR" },
        { status: 400 }
      );
    }

    if (mode !== "text" && mode !== "checklist") {
      return NextResponse.json(
        { ok: false, error: "INVALID_MODE" },
        { status: 400 }
      );
    }

    // 输入上限：标题/正文类型与长度
    const textError = validateNoteTextFields(body);
    if (textError) {
      return NextResponse.json(
        { ok: false, error: textError },
        { status: 400 }
      );
    }

    // isPinned 必须为 boolean
    if (body.isPinned !== undefined && typeof body.isPinned !== "boolean") {
      return NextResponse.json(
        { ok: false, error: "INVALID_IS_PINNED" },
        { status: 400 }
      );
    }

    if (body.checklistItems !== undefined) {
      const validationError = validateChecklistItems(body.checklistItems);
      if (validationError) {
        return NextResponse.json(
          { ok: false, error: validationError },
          { status: 400 }
        );
      }
    }

    // M16R3：新建便签可指定文件夹（null = 未分组）
    let folderId: string | null = null;
    if (body.folderId !== undefined && body.folderId !== null) {
      if (typeof body.folderId !== "string") {
        return NextResponse.json(
          { ok: false, error: "INVALID_FOLDER_ID" },
          { status: 400 }
        );
      }
      const folder = await prisma.noteFolder.findFirst({
        where: { id: body.folderId, userId: session.userId, deletedAt: null },
      });
      if (!folder) {
        return NextResponse.json(
          { ok: false, error: "INVALID_FOLDER_ID" },
          { status: 400 }
        );
      }
      folderId = body.folderId;
    }

    // M16R3：手动标签名校验（不进 updateData，由 reconcileNoteTags 落绑定表）
    let manualTags: string[] = [];
    if (body.tags !== undefined) {
      const cleaned = validateTags(body.tags);
      if (cleaned === null) {
        return NextResponse.json(
          { ok: false, error: "INVALID_TAGS" },
          { status: 400 }
        );
      }
      manualTags = cleaned;
    }

    // M16 统一文档：documentJson 校验（必须是合法 JSON 字符串或 null）
    if (body.documentJson !== undefined && body.documentJson !== null) {
      if (typeof body.documentJson !== "string") {
        return NextResponse.json(
          { ok: false, error: "INVALID_DOCUMENT" },
          { status: 400 }
        );
      }
      try {
        JSON.parse(body.documentJson);
      } catch {
        return NextResponse.json(
          { ok: false, error: "INVALID_DOCUMENT" },
          { status: 400 }
        );
      }
    }

    // 额度检查：新建后 used + newSize 不得超额度
    const newSize = notePayloadSizeBytes({
      title: body.title,
      content: body.content,
      checklistItems: body.checklistItems,
      checklistGroups: body.checklistGroups,
      documentJson: body.documentJson,
    });
    const storage = await getStorageState(session.userId);
    if (storage.used + newSize > storage.quota) {
      return NextResponse.json(
        {
          ok: false,
          error: QUOTA_EXCEEDED_ERROR,
          message: QUOTA_EXCEEDED_MESSAGE,
        },
        { status: 413 }
      );
    }

    const note = await prisma.note.create({
      data: {
        userId: session.userId,
        title: body.title ?? "",
        content: body.content ?? "",
        color,
        mode,
        checklistItems: JSON.stringify(body.checklistItems ?? []),
        documentJson: body.documentJson ?? null,
        isPinned: body.isPinned ?? false,
        sortOrder: Math.floor(Date.now() / 1000),
        folderId,
      },
    });

    await addStorageUsed(session.userId, newSize);

    await recordUserActivity(session.userId, "create_note");

    // M16R3：新建后同步标签（auto=正文抽取 ∪ manual）+ 重算出链（空内容幂等）
    await reconcileNoteTags(note.id, session.userId, note.content, manualTags);
    await recomputeNoteLinks(note.id, session.userId, note.content);

    // 重新取回（带 tagBindings）再序列化，保证响应含 tags/manualTags
    const created = await prisma.note.findUnique({
      where: { id: note.id },
      include: { attachments: true, tagBindings: { include: { tag: true } } },
    });
    if (!created) {
      return NextResponse.json(
        serializeNote(note as unknown as Record<string, unknown>)
      );
    }

    return NextResponse.json(
      serializeNote(created as unknown as Record<string, unknown>)
    );
  } catch (e) {
    console.error("POST /api/notes error:", e);
    return NextResponse.json(
      { ok: false, error: "INVALID_REQUEST" },
      { status: 400 }
    );
  }
}
