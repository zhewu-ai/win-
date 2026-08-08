import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authOrResponse } from "@/lib/auth";
import { recordUserActivity } from "@/lib/activity";
import { serializeNote, validateChecklistItems, validateChecklistGroups } from "@/lib/note-serializer";
import {
  QUOTA_EXCEEDED_ERROR,
  QUOTA_EXCEEDED_MESSAGE,
  addStorageUsed,
  getStorageState,
  noteSizeBytes,
} from "@/lib/storage";

const VALID_COLORS = ["yellow", "blue", "green", "pink", "gray"];

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await authOrResponse();
  if (session instanceof NextResponse) return session;

  const note = await prisma.note.findFirst({
    where: {
      id: params.id,
      userId: session.userId,
      deletedAt: null,
    },
    include: { attachments: true },
  });

  if (!note) {
    return NextResponse.json(
      { ok: false, error: "NOT_FOUND" },
      { status: 404 }
    );
  }

  try {
    const body = await request.json();

    if (body.color && !VALID_COLORS.includes(body.color)) {
      return NextResponse.json(
        { ok: false, error: "INVALID_COLOR" },
        { status: 400 }
      );
    }

    const allowedFields = [
      "title", "content", "color", "isPinned", "isArchived",
      "mode", "checklistItems", "checklistGroups",
      "sortOrder", "windowX", "windowY", "windowWidth", "windowHeight",
      "alwaysOnTop",
    ];

    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // Serialize checklistItems to JSON string for SQLite storage
    if (updateData["checklistItems"] !== undefined) {
      const validationError = validateChecklistItems(body["checklistItems"]);
      if (validationError) {
        return NextResponse.json(
          { ok: false, error: validationError },
          { status: 400 }
        );
      }
      updateData["checklistItems"] = JSON.stringify(updateData["checklistItems"]);
    }

    // Serialize checklistGroups to JSON string for SQLite storage
    if (updateData["checklistGroups"] !== undefined) {
      const validationError = validateChecklistGroups(body["checklistGroups"]);
      if (validationError) {
        return NextResponse.json(
          { ok: false, error: validationError },
          { status: 400 }
        );
      }
      updateData["checklistGroups"] = JSON.stringify(updateData["checklistGroups"]);
    }

    // Validate mode if provided
    if (updateData["mode"] !== undefined) {
      if (updateData["mode"] !== "text" && updateData["mode"] !== "checklist") {
        return NextResponse.json(
          { ok: false, error: "INVALID_MODE" },
          { status: 400 }
        );
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { ok: false, error: "NO_FIELDS_TO_UPDATE" },
        { status: 400 }
      );
    }

    // M10.8 无变化检测：请求字段与当前行完全一致时不执行 update。
    // @updatedAt 在任何 prisma.note.update 时都会刷新，因此必须跳过 update 才能让
    // updatedAt 只代表"真实修改时间"。结构化字段（checklistItems/Groups）已在此前
    // 归一化为与库中一致的 JSON 字符串，可直接按值比较。
    let noop = true;
    for (const [key, value] of Object.entries(updateData)) {
      if (note[key as keyof typeof note] !== value) {
        noop = false;
        break;
      }
    }
    if (noop) {
      return NextResponse.json(
        serializeNote(note as unknown as Record<string, unknown>)
      );
    }

    // 额度检查：编辑后用量 = used - oldSize + newSize，超额度则拒绝
    const oldSize = noteSizeBytes(note);
    const newSize = noteSizeBytes({
      title:
        updateData["title"] !== undefined
          ? String(updateData["title"])
          : note.title,
      content:
        updateData["content"] !== undefined
          ? String(updateData["content"])
          : note.content,
      checklistItems:
        updateData["checklistItems"] !== undefined
          ? String(updateData["checklistItems"])
          : note.checklistItems,
      checklistGroups:
        updateData["checklistGroups"] !== undefined
          ? String(updateData["checklistGroups"])
          : note.checklistGroups,
    });
    const delta = newSize - oldSize;
    const storage = await getStorageState(session.userId);
    if (storage.used + delta > storage.quota) {
      return NextResponse.json(
        {
          ok: false,
          error: QUOTA_EXCEEDED_ERROR,
          message: QUOTA_EXCEEDED_MESSAGE,
        },
        { status: 413 }
      );
    }

    const updated = await prisma.note.update({
      where: { id: params.id },
      data: updateData,
      include: { attachments: true },
    });

    await addStorageUsed(session.userId, delta);

    // M10.11 埋点：isArchived 与旧值比较，区分归档/取消归档，避免顺带传 isArchived 误报；
    // 否则带 checklistItems 记 check_todo（mode 切换误归类 SPEC 允许），其余记 edit_note。
    let action: "edit_note" | "check_todo" | "archive_note" | "unarchive_note" = "edit_note";
    if (
      updateData["isArchived"] !== undefined &&
      updateData["isArchived"] !== note.isArchived
    ) {
      action = updateData["isArchived"] ? "archive_note" : "unarchive_note";
    } else if (updateData["checklistItems"] !== undefined) {
      action = "check_todo";
    }
    await recordUserActivity(session.userId, action);

    // Deserialize checklistItems for the response
    return NextResponse.json(serializeNote(updated as unknown as Record<string, unknown>));
  } catch {
    return NextResponse.json(
      { ok: false, error: "INVALID_REQUEST" },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await authOrResponse();
  if (session instanceof NextResponse) return session;

  const note = await prisma.note.findFirst({
    where: {
      id: params.id,
      userId: session.userId,
      deletedAt: null,
    },
  });

  if (!note) {
    return NextResponse.json(
      { ok: false, error: "NOT_FOUND" },
      { status: 404 }
    );
  }

  await prisma.note.update({
    where: { id: params.id },
    data: { deletedAt: new Date() },
  });

  await recordUserActivity(session.userId, "delete_note");

  return NextResponse.json({ ok: true });
}
