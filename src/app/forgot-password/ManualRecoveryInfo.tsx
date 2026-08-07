"use client";

import { useState } from "react";
import Link from "next/link";

const ADMIN_EMAIL = "yan251@foxmail.com";
const TEMPLATE_SUBJECT = "PinNote 密码重置申请";
const TEMPLATE_BODY = `我的 PinNote 账号邮箱是：
我确认需要重置密码。`;
const TEMPLATE_FULL = `${TEMPLATE_SUBJECT}

${TEMPLATE_BODY}`;

export default function ManualRecoveryInfo() {
  const [copied, setCopied] = useState<"" | "email" | "template">("");

  const copy = async (text: string, kind: "" | "email" | "template") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        setCopied(kind);
      } finally {
        document.body.removeChild(ta);
      }
    }
    window.setTimeout(() => setCopied(""), 2000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-page-bg px-4 py-6">
      <div className="w-full max-w-xs bg-toolbar-bg rounded-[14px] border border-border-light p-6 shadow-2xl shadow-black/20">
        <img
          src="/icon.png"
          alt="PinNote"
          className="w-14 h-14 rounded-xl mx-auto mb-3 object-cover shadow-md shadow-black/10"
        />
        <h1 className="text-login-title font-semibold text-center text-ink mb-1">
          找回密码
        </h1>
        <p className="text-list-summary text-ink-muted text-center mb-5">
          请使用你账号绑定的邮箱发送密码重置申请。管理员确认发件邮箱与账号绑定邮箱一致后，会为你重置临时密码。
        </p>

        <div className="mb-4 p-3 bg-search-bg border border-border-soft rounded-card">
          <p className="text-toolbar font-medium text-ink">管理员邮箱</p>
          <p className="mt-1 text-sm font-mono text-ink break-all">
            {ADMIN_EMAIL}
          </p>
          <button
            type="button"
            onClick={() => void copy(ADMIN_EMAIL, "email")}
            className="mt-2.5 w-full py-2 px-4 bg-primary text-white rounded-btn hover:brightness-110 active:brightness-95 transition-all font-semibold text-sm"
          >
            {copied === "email" ? "已复制" : "复制邮箱"}
          </button>
        </div>

        <div className="mb-5 p-3 bg-search-bg border border-border-soft rounded-card">
          <p className="text-toolbar font-medium text-ink">邮件模板</p>
          <p className="mt-2 text-xs text-ink-muted break-words">
            <span className="text-ink-secondary">标题：</span>
            {TEMPLATE_SUBJECT}
          </p>
          <p className="mt-2 text-xs text-ink-muted whitespace-pre-line break-words">
            <span className="text-ink-secondary">正文：</span>
            {TEMPLATE_BODY}
          </p>
          <button
            type="button"
            onClick={() => void copy(TEMPLATE_FULL, "template")}
            className="mt-2.5 w-full py-2 px-4 bg-primary text-white rounded-btn hover:brightness-110 active:brightness-95 transition-all font-semibold text-sm"
          >
            {copied === "template" ? "已复制" : "复制邮件模板"}
          </button>
        </div>

        <p className="mb-4 text-list-meta text-ink-muted">
          注意：必须用你账号绑定的邮箱发信，否则管理员无法核实你的身份。
        </p>

        <Link
          href="/login"
          className="block w-full py-2.5 px-4 bg-selection-yellow text-white rounded-btn hover:brightness-110 active:brightness-95 transition-all font-semibold text-center"
        >
          返回登录
        </Link>
      </div>
    </div>
  );
}
