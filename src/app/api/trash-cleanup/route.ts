import { NextResponse } from "next/server";
import { runTrashCleanup } from "@/lib/trash-cleanup";

export const dynamic = "force-dynamic";

/**
 * Internal maintenance endpoint for the daily trash cleanup timer.
 * The app listens on 127.0.0.1 only, so a request with no X-Forwarded-For
 * header is local; when proxied through Caddy the header is set, and only
 * loopback is accepted.
 */
export async function POST(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for") || "";
  const first = forwarded.split(",")[0].trim();
  const loopback = first === "127.0.0.1" || first === "::1";
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
