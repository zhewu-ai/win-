import crypto from "crypto";

// 邀请码字符集：大写字母 + 数字，去掉易混字符 O/0/I/1（SPEC §6.1）
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const GROUP_SIZE = 4;
const GROUPS = 4;

export const DEFAULT_EXPIRES_DAYS = 7;

/** 生成不可预测、不可重复的邀请码，形如 PN-8K7Q-M4ZR-W2XA-9Y3B（20 字符）。 */
export function generateInviteCode(): string {
  const parts: string[] = [];
  for (let g = 0; g < GROUPS; g++) {
    let group = "";
    for (let i = 0; i < GROUP_SIZE; i++) {
      group += ALPHABET[crypto.randomInt(0, ALPHABET.length)];
    }
    parts.push(group);
  }
  return `PN-${parts.join("-")}`;
}

/** 邀请码只以哈希形式入库，明文仅在生成当次返回（SPEC §5.2）。 */
export function hashInviteCode(code: string): string {
  return crypto.createHash("sha256").update(code, "utf8").digest("hex");
}
