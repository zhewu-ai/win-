"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

function safeReturnTo(path?: string): string {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return "/";
  return path;
}

export default function LoginForm({ returnTo }: { returnTo?: string }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();

      if (!data.ok) {
        setError("用户名或密码错误");
        return;
      }

      router.push(safeReturnTo(returnTo));
    } catch (e) {
      setError(
        e instanceof TypeError
          ? "离线状态无法登录，联网后重试"
          : "登录失败，请检查网络连接"
      );
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
          PinNote
        </h1>
        <p className="text-list-summary text-ink-muted text-center mb-6">
          请登录以继续
        </p>

        {error && (
          <div className="mb-4 p-3 bg-danger/5 border border-danger/20 text-danger text-list-meta rounded-btn">
            {error}
          </div>
        )}

        <div className="mb-4">
          <label className="block text-toolbar font-medium text-ink mb-1.5">
            邮箱或用户名
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-3 py-2.5 text-ink bg-search-bg border border-border-soft rounded-input outline-none focus:bg-surface-focus focus:border-surface-focus focus:ring-1 focus:ring-surface-focus transition-all placeholder:text-ink-muted"
            placeholder="请输入邮箱或用户名"
            required
            autoFocus
          />
        </div>

        <div className="mb-6">
          <label className="block text-toolbar font-medium text-ink mb-1.5">
            密码
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2.5 text-ink bg-search-bg border border-border-soft rounded-input outline-none focus:bg-surface-focus focus:border-surface-focus focus:ring-1 focus:ring-surface-focus transition-all placeholder:text-ink-muted"
            placeholder="请输入密码"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 px-4 bg-selection-yellow text-white rounded-btn hover:brightness-110 active:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-semibold"
        >
          {loading ? "登录中..." : "登录"}
        </button>

        <p className="mt-3 text-center text-list-meta text-ink-muted">
          <Link
            href="/forgot-password"
            className="text-ink font-medium hover:underline"
          >
            忘记密码？
          </Link>
        </p>

        <p className="mt-3 text-center text-list-meta text-ink-muted">
          没有账号？
          <Link
            href="/register"
            className="text-ink font-medium hover:underline"
          >
            使用邀请码注册
          </Link>
        </p>
      </form>
    </div>
  );
}
