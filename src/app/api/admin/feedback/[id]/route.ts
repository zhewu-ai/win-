import { NextResponse } from "next/server";
import { requireAdmin, toErrorResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const VALID_STATUSES = ["open", "reviewing", "resolved", "closed"];
const MAX_ADMIN_NOTE = 2000;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await requireAdmin();
  } catch (e) {
    return toErrorResponse(e);
  }

  let body: { status?: unknown; adminNote?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "INVALID_REQUEST" },
      { status: 400 }
    );
  }

  const updateData: { status?: string; adminNote?: string | null } = {};

  if (body.status !== undefined) {
    if (
      typeof body.status !== "string" ||
      !VALID_STATUSES.includes(body.status)
    ) {
      return NextResponse.json(
        { ok: false, error: "INVALID_STATUS" },
        { status: 400 }
      );
    }
    updateData.status = body.status;
  }

  if (body.adminNote !== undefined) {
    if (body.adminNote !== null && typeof body.adminNote !== "string") {
      return NextResponse.json(
        { ok: false, error: "INVALID_ADMIN_NOTE" },
        { status: 400 }
      );
    }
    const note = body.adminNote === null ? null : body.adminNote.trim();
    if (note !== null && note.length > MAX_ADMIN_NOTE) {
      return NextResponse.json(
        { ok: false, error: "ADMIN_NOTE_TOO_LONG" },
        { status: 400 }
      );
    }
    updateData.adminNote = note !== null && note.length > 0 ? note : null;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json(
      { ok: false, error: "NO_FIELDS_TO_UPDATE" },
      { status: 400 }
    );
  }

  const existing = await prisma.feedbackTicket.findUnique({
    where: { id: id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json(
      { ok: false, error: "TICKET_NOT_FOUND" },
      { status: 404 }
    );
  }

  const ticket = await prisma.feedbackTicket.update({
    where: { id: id },
    data: updateData,
    select: {
      id: true,
      type: true,
      title: true,
      content: true,
      status: true,
      pageUrl: true,
      userAgent: true,
      appVersion: true,
      adminNote: true,
      createdAt: true,
      updatedAt: true,
      user: {
        select: {
          id: true,
          username: true,
          email: true,
          displayName: true,
        },
      },
    },
  });

  return NextResponse.json({ ok: true, ticket });
}
