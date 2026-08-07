import crypto from "crypto";

/** 重置链接有效期：30 分钟 */
export const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

/** 生成一次性的明文重置 token，只进入邮件链接，不落库。 */
export function generateResetToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

/** 数据库只存 token 的 sha256 哈希。 */
export function hashResetToken(token: string): string {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}
