import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { serializeNote, validateChecklistItems, validateChecklistGroups } from "@/lib/note-serializer";

const VALID_COLORS = ["yellow", "blue", "green", "pink", "gray"];

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

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

    const updated = await prisma.note.update({
      where: { id: params.id },
      data: updateData,
      include: { attachments: true },
    });

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
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

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

  return NextResponse.json({ ok: true });
}
