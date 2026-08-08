import { NextResponse } from "next/server";
import { runTrashCleanup } from "@/lib/trash-cleanup";

export const dynamic = "force-dynamic";

/**
 * Internal maintenance endpoint for the daily trash cleanup timer.
 * 配置 TRASH_CLEANUP_SECRET 后要求 `Authorization: Bearer <secret>`，
 * 否则拒绝（不再只依赖客户端可控的 x-forwarded-for）。
 * 未配置密钥时退回回环判断（本地开发）：仅接受回环来源，伪造 XFF 返回 403。
 * 当服务绑定双栈通配地址时，IPv4 回环连接会以 ::ffff:127.0.0.1 形式到达，
 * 先归一化再判回环。
 */
export async function POST(request: Request) {
  const secret = process.env.TRASH_CLEANUP_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization") || "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json(
        { ok: false, error: "FORBIDDEN" },
        { status: 403 }
      );
    }
  } else {
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
