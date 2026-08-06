import { NextResponse } from "next/server";
import { getCurrentUser, getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const AVATAR_COLORS = ["yellow", "blue", "green", "pink", "gray"];
const MAX_DISPLAY_NAME = 40;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED" },
      { status: 401 }
    );
  }
  return NextResponse.json({ ok: true, user });
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "INVALID_REQUEST" },
      { status: 400 }
    );
  }

  const updateData: Record<string, unknown> = {};

  if (body.displayName !== undefined) {
    if (typeof body.displayName !== "string") {
      return NextResponse.json(
        { ok: false, error: "INVALID_DISPLAY_NAME" },
        { status: 400 }
      );
    }
    const trimmed = body.displayName.trim();
    if (trimmed.length > MAX_DISPLAY_NAME) {
      return NextResponse.json(
        { ok: false, error: "DISPLAY_NAME_TOO_LONG" },
        { status: 400 }
      );
    }
    // 空昵称清空为 null，前端 fallback 到 username
    updateData.displayName = trimmed.length > 0 ? trimmed : null;
  }

  if (body.avatarColor !== undefined) {
    if (
      typeof body.avatarColor !== "string" ||
      !AVATAR_COLORS.includes(body.avatarColor)
    ) {
      return NextResponse.json(
        { ok: false, error: "INVALID_AVATAR_COLOR" },
        { status: 400 }
      );
    }
    updateData.avatarColor = body.avatarColor;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json(
      { ok: false, error: "NO_FIELDS_TO_UPDATE" },
      { status: 400 }
    );
  }

  const user = await prisma.user.update({
    where: { id: session.userId },
    data: updateData,
    select: { id: true, username: true, displayName: true, avatarColor: true },
  });

  return NextResponse.json({ ok: true, user });
}
