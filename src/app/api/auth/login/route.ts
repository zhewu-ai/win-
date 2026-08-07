import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { ok: false, error: "INVALID_CREDENTIALS" },
        { status: 400 }
      );
    }

    const identifier = String(username).trim();
    // 兼容老账号 username 与新账号 email（email 入库前已小写归一化）
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ username: identifier }, { email: identifier.toLowerCase() }],
      },
    });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return NextResponse.json(
        { ok: false, error: "INVALID_CREDENTIALS" },
        { status: 401 }
      );
    }

    // 被禁用账号不能登录
    if (user.status !== "active") {
      return NextResponse.json(
        {
          ok: false,
          error: "ACCOUNT_DISABLED",
          message: "账号已被禁用，请联系管理员",
        },
        { status: 403 }
      );
    }

    const session = await getSession();
    session.userId = user.id;
    await session.save();

    return NextResponse.json({
      ok: true,
      user: { id: user.id, username: user.username },
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "INVALID_CREDENTIALS" },
      { status: 401 }
    );
  }
}
