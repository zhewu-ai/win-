import { NextResponse } from "next/server";
import { runTrashCleanup } from "@/lib/trash-cleanup";

export const dynamic = "force-dynamic";

/**
 * Internal maintenance endpoint for the daily trash cleanup timer.
 * Only loopback callers are accepted. When the app binds a dual-stack
 * wildcard, IPv4 loopback connections arrive as IPv6-mapped ::ffff:127.0.0.1,
 * so that form is normalized to 127.0.0.1 before the loopback check.
 */
export async function POST(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for") || "";
  const first = forwarded.split(",")[0].trim().replace(/^::ffff:/, "");
  const loopback =
    first === "127.0.0.1" || first === "::1" || /^127\./.test(first);
  if (forwarded && !loopback) {
    return NextResponse.json(
      { ok: false, error: "FORBIDDEN" },
      { status: 403 }
    );
  }

  try {
    const purged = await runTrashCleanup(true);
    return NextResponse.json({ ok: true, purged });
  } catch (e) {
    console.error("POST /api/trash-cleanup error:", e);
    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
