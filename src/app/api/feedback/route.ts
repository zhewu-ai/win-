import { NextResponse } from "next/server";
import { authOrResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rateLimit";
import { recordUserActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

const VALID_TYPES = ["bug", "feature", "other"];
const MAX_TITLE = 80;
const MAX_CONTENT = 2000;
const MAX_PAGE_URL = 500;
const MAX_APP_VERSION = 64;
const RATE_LIMIT = 3;
const RATE_WINDOW_MS = 60_000;

export async function POST(request: Request) {
  const session = await authOrResponse();
  if (session instanceof NextResponse) return session;
  const userId = session.userId;

  if (!rateLimit(`feedback:user:${userId}`, RATE_LIMIT, RATE_WINDOW_MS)) {
    return NextResponse.json(
      { ok: false, error: "RATE_LIMITED" },
      { status: 429 }
    );
  }

  let body: {
    type?: unknown;
    title?: unknown;
    content?: unknown;
    pageUrl?: unknown;
    appVersion?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "INVALID_REQUEST" },
      { status: 400 }
    );
  }

  const type = body.type;
  if (typeof type !== "string" || !VALID_TYPES.includes(type)) {
    return NextResponse.json(
      { ok: false, error: "INVALID_FEEDBACK_TYPE" },
      { status: 400 }
    );
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (title.length === 0) {
    return NextResponse.json(
      { ok: false, error: "TITLE_REQUIRED" },
      { status: 400 }
    );
  }
  if (title.length > MAX_TITLE) {
    return NextResponse.json(
      { ok: false, error: "TITLE_TOO_LONG" },
      { status: 400 }
    );
  }

  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (content.length === 0) {
    return NextResponse.json(
      { ok: false, error: "CONTENT_REQUIRED" },
      { status: 400 }
    );
  }
  if (content.length > MAX_CONTENT) {
    return NextResponse.json(
      { ok: false, error: "CONTENT_TOO_LONG" },
      { status: 400 }
    );
  }

  const pageUrl =
    typeof body.pageUrl === "string" && body.pageUrl.trim().length > 0
      ? body.pageUrl.trim().slice(0, MAX_PAGE_URL)
      : null;
  const appVersion =
    typeof body.appVersion === "string" && body.appVersion.trim().length > 0
      ? body.appVersion.trim().slice(0, MAX_APP_VERSION)
      : null;
  const userAgent = request.headers.get("user-agent") || null;

  const ticket = await prisma.feedbackTicket.create({
    data: {
      userId,
      type,
      title,
      content,
      pageUrl,
      userAgent,
      appVersion,
    },
    select: { id: true },
  });

  await recordUserActivity(userId, "submit_feedback", { type });

  return NextResponse.json({ ok: true, ticket });
}
