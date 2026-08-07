import nodemailer from "nodemailer";
import { appendFileSync } from "fs";

export const APP_BASE_URL = process.env.APP_BASE_URL || "http://localhost:3000";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

export type MailResult = { ok: true } | { ok: false; reason: string };

/**
 * SMTP 邮件发送。生产未配置 SMTP 时返回失败（调用方记录 serverError，不崩溃）。
 * 仅本地开发：配置 DEV_MAILBOX 后把邮件落盘到该文件，便于无 SMTP 的端到端测试。
 */
export async function sendMail(msg: MailMessage): Promise<MailResult> {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM;

  if (!host || !user || !pass || !from) {
    const devMailbox = process.env.DEV_MAILBOX;
    if (devMailbox) {
      appendFileSync(
        devMailbox,
        JSON.stringify({ ts: new Date().toISOString(), ...msg }) + "\n",
        "utf8"
      );
      return { ok: true };
    }
    return { ok: false, reason: "SMTP_NOT_CONFIGURED" };
  }

  const port = Number(process.env.SMTP_PORT || 465);
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  try {
    await transporter.sendMail({ from, to: msg.to, subject: msg.subject, text: msg.text });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "SEND_FAILED" };
  }
}

/** 生成密码重置邮件正文；不包含旧密码/hash/多余账号信息。 */
export function buildResetEmail(to: string, resetLink: string): MailMessage {
  return {
    to,
    subject: "重置你的 PinNote 密码",
    text: [
      "你正在重置 PinNote 密码。",
      "",
      `点击下面的链接设置新密码：`,
      resetLink,
      "",
      "该链接 30 分钟内有效，且只能使用一次。",
      "如果不是你本人操作，可以忽略这封邮件。",
    ].join("\n"),
  };
}
