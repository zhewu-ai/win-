import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authOrResponse } from "@/lib/auth";
import { serializeNote, validateChecklistItems } from "@/lib/note-serializer";
import { recordUserActivity } from "@/lib/activity";
import {
  QUOTA_EXCEEDED_ERROR,
  QUOTA_EXCEEDED_MESSAGE,
  addStorageUsed,
  getStorageState,
  notePayloadSizeBytes,
} from "@/lib/storage";

const VALID_COLORS = ["yellow", "blue", "green", "pink", "gray"];

export async function GET(request: Request) {
  try {
    const session = await authOrResponse();
    if (session instanceof NextResponse) return session;

    const { searchParams } = new URL(request.url);
    const archivedParam = searchParams.get("archived");
    const isArchived = archivedParam ? archivedParam === "true" : false;
    const q = searchParams.get("q") || "";

    const where: Record<string, unknown> = {
      userId: session.userId,
      deletedAt: null,
      isArchived,
    };

    if (q) {
      where.OR = [
        { title: { contains: q } },
        { content: { contains: q } },
        { checklistItems: { contains: q } },
      ];
    }

    const notes = await prisma.note.findMany({
      where,
      include: { attachments: true },
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

    if (body.checklistItems !== undefined) {
      const validationError = validateChecklistItems(body.checklistItems);
      if (validationError) {
        return NextResponse.json(
          { ok: false, error: validationError },
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
        isPinned: body.isPinned ?? false,
        sortOrder: Math.floor(Date.now() / 1000),
      },
    });

    await addStorageUsed(session.userId, newSize);

    await recordUserActivity(session.userId, "create_note");

    return NextResponse.json(
      serializeNote(note as unknown as Record<string, unknown>)
    );
  } catch (e) {
    console.error("POST /api/notes error:", e);
    return NextResponse.json(
      { ok: false, error: "INVALID_REQUEST" },
      { status: 400 }
    );
  }
}
