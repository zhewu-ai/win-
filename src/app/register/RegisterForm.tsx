"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function friendlyError(error: string): string {
  if (error === "INVALID_EMAIL") return "请输入有效的邮箱地址";
  if (error === "EMAIL_ALREADY_REGISTERED") return "该邮箱已注册，可直接登录";
  if (error === "PASSWORD_TOO_SHORT") return "密码至少 8 位";
  if (error === "REGISTER_FAILED") return "注册失败，请稍后重试";
  // INVALID_INVITE_CODE / INVITE_REVOKED / INVITE_USED / INVITE_EXPIRED 统一收敛（SPEC §8.3）
  return "邀请码无效或已过期";
}

export default function RegisterForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!EMAIL_REGEX.test(email.trim())) {
      setError("请输入有效的邮箱地址");
      return;
    }
    if (password.length < 8) {
      setError("密码至少 8 位");
      return;
    }
    if (password !== confirm) {
      setError("两次输入的密码不一致");
      return;
    }
    if (!inviteCode.trim()) {
      setError("请输入邀请码");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          inviteCode: inviteCode.trim(),
        }),
      });
      const data = await res.json();

      if (!data.ok) {
        setError(friendlyError(data.error));
        return;
      }

      router.push("/");
    } catch {
      setError("注册失败，请检查网络连接");
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
          使用邀请码注册
        </h1>
        <p className="text-list-summary text-ink-muted text-center mb-6">
          请填写邮箱、密码与邀请码
        </p>

        {error && (
          <div className="mb-4 p-3 bg-danger/5 border border-danger/20 text-danger text-list-meta rounded-btn">
            {error}
          </div>
        )}

        <div className="mb-4">
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
          />
        </div>

        <div className="mb-4">
          <label className="block text-toolbar font-medium text-ink mb-1.5">
            密码
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2.5 text-ink bg-search-bg border border-border-soft rounded-input outline-none focus:bg-surface-focus focus:border-surface-focus focus:ring-1 focus:ring-surface-focus transition-all placeholder:text-ink-muted"
            placeholder="至少 8 位"
            required
          />
          <p className="mt-1 text-[11px] text-ink-muted">
            建议包含字母和数字
          </p>
        </div>

        <div className="mb-4">
          <label className="block text-toolbar font-medium text-ink mb-1.5">
            确认密码
          </label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full px-3 py-2.5 text-ink bg-search-bg border border-border-soft rounded-input outline-none focus:bg-surface-focus focus:border-surface-focus focus:ring-1 focus:ring-surface-focus transition-all placeholder:text-ink-muted"
            placeholder="再次输入密码"
            required
          />
        </div>

        <div className="mb-6">
          <label className="block text-toolbar font-medium text-ink mb-1.5">
            邀请码
          </label>
          <input
            type="text"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            className="w-full px-3 py-2.5 text-ink bg-search-bg border border-border-soft rounded-input outline-none focus:bg-surface-focus focus:border-surface-focus focus:ring-1 focus:ring-surface-focus transition-all placeholder:text-ink-muted"
            placeholder="PN-XXXX-XXXX-XXXX-XXXX"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 px-4 bg-selection-yellow text-white rounded-btn hover:brightness-110 active:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-semibold"
        >
          {loading ? "注册中..." : "注册"}
        </button>

        <p className="mt-4 text-center text-list-meta text-ink-muted">
          已有账号？
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
