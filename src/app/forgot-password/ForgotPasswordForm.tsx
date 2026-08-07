"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GENERIC_MESSAGE = "如果该邮箱已注册，我们会发送密码重置邮件。";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!EMAIL_REGEX.test(email.trim())) {
      setError("请输入有效的邮箱地址");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (res.status === 429) {
        setError("请求过于频繁，请 1 分钟后再试");
        return;
      }
      if (!data.ok) {
        setError("请求失败，请稍后重试");
        return;
      }

      // 无论邮箱是否存在，都显示通用成功文案
      setSent(true);
    } catch {
      setError("网络异常，请检查网络后重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-page-bg px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-xs bg-toolbar-bg rounded-[14px] border border-border-light p-6 shadow-2xl shadow-black/20"
      >
        <img
          src="/icon.png"
          alt="PinNote"
          className="w-14 h-14 rounded-xl mx-auto mb-3 object-cover shadow-md shadow-black/10"
        />
        <h1 className="text-login-title font-semibold text-center text-ink mb-1">
          忘记密码
        </h1>
        <p className="text-list-summary text-ink-muted text-center mb-6">
          输入注册邮箱，我们将发送密码重置链接
        </p>

        {error && (
          <div className="mb-4 p-3 bg-danger/5 border border-danger/20 text-danger text-list-meta rounded-btn">
            {error}
          </div>
        )}

        {sent ? (
          <div className="mb-4 p-3 bg-emerald-500/5 border border-emerald-500/25 text-emerald-700 text-list-meta rounded-btn">
            {GENERIC_MESSAGE}
          </div>
        ) : (
          <div className="mb-6">
            <label className="block text-toolbar font-medium text-ink mb-1.5">
              邮箱
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2.5 text-ink bg-search-bg border border-border-soft rounded-input outline-none focus:bg-surface-focus focus:border-surface-focus focus:ring-1 focus:ring-surface-focus transition-all placeholder:text-ink-muted"
              placeholder="you@example.com"
              required
              autoFocus
              disabled={loading}
            />
          </div>
        )}

        {!sent && (
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-selection-yellow text-white rounded-btn hover:brightness-110 active:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-semibold"
          >
            {loading ? "发送中..." : "发送重置邮件"}
          </button>
        )}

        <p className="mt-4 text-center text-list-meta text-ink-muted">
          想起密码了？
          <Link
            href="/login"
            className="text-ink font-medium hover:underline"
          >
            返回登录
          </Link>
        </p>
      </form>
    </div>
  );
}
