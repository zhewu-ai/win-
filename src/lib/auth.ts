import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SessionData, sessionOptions } from "./session";
import { prisma } from "./prisma";

export async function getSession() {
  const session = await getIronSession<SessionData>(cookies(), sessionOptions);
  return session;
}

const CURRENT_USER_SELECT = {
  id: true,
  username: true,
  displayName: true,
  avatarColor: true,
  storageQuotaBytes: true,
  storageUsedBytes: true,
  role: true,
  status: true,
} as const;

export async function getCurrentUser() {
  const session = await getSession();
  if (!session.userId) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: CURRENT_USER_SELECT,
  });
  return user;
}

/** 带 HTTP 状态码的鉴权错误，供路由统一映射为 JSON 响应。 */
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * 业务 API 统一鉴权：返回活跃用户 id。
 * 未登录抛 401 UNAUTHORIZED；账号被禁用抛 403 ACCOUNT_DISABLED（旧 session 也不能操作）。
 */
export async function getActiveSessionUser(): Promise<{ id: string }> {
  const session = await getSession();
  if (!session.userId) throw new HttpError(401, "UNAUTHORIZED");
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, status: true },
  });
  if (!user || user.status !== "active") throw new HttpError(403, "ACCOUNT_DISABLED");
  return user;
}

/** 将 HttpError 映射为统一 JSON 响应；未知错误回退 500。 */
export function toErrorResponse(e: unknown): NextResponse {
  const status = e instanceof HttpError ? e.status : 500;
  const code = e instanceof HttpError ? e.message : "SERVER_ERROR";
  return NextResponse.json({ ok: false, error: code }, { status });
}

/**
 * 返回 `{ userId }` 或错误响应。路由用法：
 * `const session = await authOrResponse(); if (session instanceof NextResponse) return session;`
 */
export async function authOrResponse(): Promise<{ userId: string } | NextResponse> {
  try {
    const user = await getActiveSessionUser();
    return { userId: user.id };
  } catch (e) {
    return toErrorResponse(e);
  }
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, "UNAUTHORIZED");
  if (user.status !== "active") throw new HttpError(403, "ACCOUNT_DISABLED");
  return user;
}

/** 管理员专用：未登录 401；禁用 403 ACCOUNT_DISABLED；非 admin 403 FORBIDDEN。 */
export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, "UNAUTHORIZED");
  if (user.status !== "active") throw new HttpError(403, "ACCOUNT_DISABLED");
  if (user.role !== "admin") throw new HttpError(403, "FORBIDDEN");
  return user;
}
