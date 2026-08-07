"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

function friendlyError(error: string): string {
  if (error === "INVALID_RESET_TOKEN") return "链接无效，请重新申请";
  if (error === "RESET_TOKEN_USED") return "链接已被使用，请重新申请";
  if (error === "RESET_TOKEN_EXPIRED") return "链接已过期，请重新申请";
  if (error === "PASSWORD_TOO_SHORT") return "密码至少 8 位";
  if (error === "ACCOUNT_DISABLED") return "账号已被禁用，请联系管理员";
  return "重置失败，请稍后重试";
}

export default function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-page-bg px-4">
        <div className="w-full max-w-xs bg-toolbar-bg rounded-[14px] border border-border-light p-6 shadow-2xl shadow-black/20 text-center">
          <h1 className="text-login-title font-semibold text-ink mb-3">
            链接无效
          </h1>
          <p className="text-list-summary text-ink-muted mb-5">
            请从邮件中的重置链接进入本页，或重新申请。
          </p>
          <Link
            href="/forgot-password"
            className="block w-full py-2.5 px-4 bg-selection-yellow text-white rounded-btn hover:brightness-110 active:brightness-95 transition-all font-semibold text-center"
          >
            重新申请
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("密码至少 8 位");
      return;
    }
    if (password !== confirm) {
      setError("两次输入的密码不一致");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await res.json();

      if (!data.ok) {
        setError(friendlyError(data.error));
        return;
      }

      setDone(true);
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
          设置新密码
        </h1>
        <p className="text-list-summary text-ink-muted text-center mb-6">
          输入新密码以继续
        </p>

        {error && (
          <div className="mb-4 p-3 bg-danger/5 border border-danger/20 text-danger text-list-meta rounded-btn">
            {error}
          </div>
        )}

        {done ? (
          <div className="mb-4 p-3 bg-emerald-500/5 border border-emerald-500/25 text-emerald-700 text-list-meta rounded-btn">
            密码已重置，请重新登录。
          </div>
        ) : (
          <>
            <div className="mb-4">
              <label className="block text-toolbar font-medium text-ink mb-1.5">
                新密码
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2.5 text-ink bg-search-bg border border-border-soft rounded-input outline-none focus:bg-surface-focus focus:border-surface-focus focus:ring-1 focus:ring-surface-focus transition-all placeholder:text-ink-muted"
                placeholder="至少 8 位"
                required
                autoFocus
              />
            </div>

            <div className="mb-6">
              <label className="block text-toolbar font-medium text-ink mb-1.5">
                确认新密码
              </label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full px-3 py-2.5 text-ink bg-search-bg border border-border-soft rounded-input outline-none focus:bg-surface-focus focus:border-surface-focus focus:ring-1 focus:ring-surface-focus transition-all placeholder:text-ink-muted"
                placeholder="再次输入新密码"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-selection-yellow text-white rounded-btn hover:brightness-110 active:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-semibold"
            >
              {loading ? "提交中..." : "重置密码"}
            </button>
          </>
        )}

        <p className="mt-4 text-center text-list-meta text-ink-muted">
          <Link
            href="/login"
            className="text-ink font-medium hover:underline"
          >
            去登录
          </Link>
        </p>
      </form>
    </div>
  );
}
