"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useTheme } from "@/hooks/useTheme";
import { useSyncStatus } from "@/hooks/useSyncStatus";
import ConfirmDialog from "./ConfirmDialog";
import ChangePasswordModal from "./ChangePasswordModal";
import ChangeAvatarModal from "./ChangeAvatarModal";
import FeedbackModal from "./FeedbackModal";
import UserAvatar from "./UserAvatar";
import { isTauri } from "@/lib/tauri";
import { DESKTOP_APP_DOWNLOAD_PAGE_URL } from "@/lib/downloads";
import type { User } from "@/types";

interface Props {
  /** Tailwind classes for dropdown position, e.g. "top-full mt-1.5" (opens down) or "bottom-full mb-1.5" (opens up). */
  dropdownPos?: string;
}

function formatUsageBytes(bytes: number): string {
  if (bytes <= 0) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  const mb = bytes / (1024 * 1024);
  return `${mb >= 10 ? mb.toFixed(0) : mb.toFixed(1)} MB`;
}

function storageBarColor(pct: number): string {
  if (pct >= 100) return "bg-danger";
  if (pct >= 95) return "bg-accent-pink";
  if (pct >= 80) return "bg-accent-yellow";
  return "bg-primary";
}

function storageStatus(pct: number): { text: string; cls: string } {
  if (pct >= 100) return { text: "空间已满，无法上传图片", cls: "text-danger" };
  if (pct >= 95) return { text: "空间即将用尽", cls: "text-accent-pink" };
  if (pct >= 80) return { text: "空间快满", cls: "text-accent-yellow" };
  return { text: "空间正常", cls: "text-ink-muted" };
}

export default function AccountMenu({
  dropdownPos = "top-full mt-1.5",
}: Props) {
  const [open, setOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [changePwOpen, setChangePwOpen] = useState(false);
  const [changeAvatarOpen, setChangeAvatarOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [nameError, setNameError] = useState("");
  const [savingName, setSavingName] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { theme, setTheme } = useTheme();
  const { pendingCount } = useSyncStatus();

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d?.user) setUser(d.user);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // 每次打开菜单刷新用户信息（存储用量随上传/删除变化）
  useEffect(() => {
    if (!open) return;
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.user) setUser(d.user);
      })
      .catch(() => {});
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const displayName = user?.displayName || user?.username || "…";
  const quota = user?.storageQuotaBytes;
  const used = user?.storageUsedBytes;
  const pct =
    quota && typeof used === "number" && quota > 0
      ? Math.min(100, (used / quota) * 100)
      : 0;

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  const handleLogoutClick = () => {
    setOpen(false);
    // 有未同步内容时要求明确确认，防止本地草稿无法同步（SPEC 12.4）
    if (pendingCount > 0) {
      setLogoutConfirmOpen(true);
    } else {
      void handleLogout();
    }
  };

  const openNameEditor = () => {
    setNameInput(user?.displayName || "");
    setNameError("");
    setEditingName(true);
  };

  const saveName = async () => {
    const value = nameInput.trim();
    if (value.length > 40) {
      setNameError("昵称不能超过 40 个字符");
      return;
    }
    setSavingName(true);
    setNameError("");
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: value }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setNameError(data.error || "保存失败");
        return;
      }
      setUser((prev) => ({ ...(prev || ({} as User)), ...data.user }));
      setEditingName(false);
    } catch {
      setNameError("保存失败，请检查网络");
    } finally {
      setSavingName(false);
    }
  };

  return (
    <div className="relative flex-shrink-0" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 pl-1 pr-1.5 py-1 text-ink-muted hover:text-ink hover:bg-surface-hover rounded-btn transition-colors"
        title="账户菜单"
        aria-expanded={open}
      >
        <UserAvatar user={user} size="sm" />
        <span className="hidden sm:inline text-sm font-medium max-w-[7rem] truncate">
          {displayName}
        </span>
        <svg className="hidden sm:block w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className={`absolute right-0 w-56 py-1 bg-toolbar-bg border border-border-light rounded-card shadow-xl z-20 ${dropdownPos}`}>
          {/* 当前用户信息 */}
          <div className="flex items-center gap-2.5 px-3.5 py-2.5">
            <UserAvatar user={user} size="md" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ink truncate">{displayName}</p>
              <p className="text-[11px] text-ink-muted truncate">@{user?.username || ""}</p>
            </div>
          </div>

          {/* 存储空间：已用/总量 + 进度条 + 阈值提示。轻量，不挤压昵称/菜单项/退出按钮。 */}
          {typeof quota === "number" &&
            typeof used === "number" &&
            quota > 0 && (
              <div className="px-3.5 pt-1 pb-2.5 border-b border-border-light/60">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[11px] text-ink-muted flex-shrink-0">存储空间</span>
                  <span className="text-[11px] text-ink-secondary text-right">
                    已用 {formatUsageBytes(used)} / {formatUsageBytes(quota)}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-surface-active overflow-hidden">
                  <div
                    className={`h-full rounded-full ${storageBarColor(pct)}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className={`mt-1 text-[11px] text-right ${storageStatus(pct).cls}`}>
                  {storageStatus(pct).text}
                </p>
              </div>
            )}

          {editingName ? (
            <div className="px-3.5 py-2.5">
              <input
                autoFocus
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void saveName();
                  if (e.key === "Escape") setEditingName(false);
                }}
                placeholder="输入昵称（空则显示用户名）"
                className="w-full px-2.5 py-1.5 text-sm text-ink bg-search-bg border border-border-soft rounded-input outline-none focus:border-surface-focus focus:ring-1 focus:ring-surface-focus transition-all placeholder:text-ink-muted/60"
              />
              {nameError && (
                <p className="mt-1 text-[11px] text-danger">{nameError}</p>
              )}
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => void saveName()}
                  disabled={savingName}
                  className="flex-1 py-1.5 text-xs font-medium text-white bg-primary rounded-btn hover:brightness-110 active:brightness-95 disabled:opacity-50 transition-all"
                >
                  {savingName ? "保存中..." : "保存"}
                </button>
                <button
                  onClick={() => setEditingName(false)}
                  className="flex-1 py-1.5 text-xs text-ink-muted hover:text-ink hover:bg-surface-hover rounded-btn transition-colors"
                >
                  取消
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={openNameEditor}
              className="flex items-center gap-2 w-full px-3.5 py-2 text-sm text-ink hover:bg-surface-hover transition-colors"
            >
              <svg className="w-4 h-4 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              修改昵称
            </button>
          )}

          <button
            onClick={() => {
              setOpen(false);
              setChangeAvatarOpen(true);
            }}
            className="flex items-center gap-2 w-full px-3.5 py-2 text-sm text-ink hover:bg-surface-hover transition-colors"
          >
            <svg className="w-4 h-4 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            更换头像
          </button>

          <div className="my-1 h-px bg-border-light/60" />
          <a
            href="/archive"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3.5 py-2.5 text-sm text-ink hover:bg-surface-hover transition-colors"
          >
            <svg className="w-4 h-4 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
            归档
          </a>
          <a
            href="/trash"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3.5 py-2.5 text-sm text-ink hover:bg-surface-hover transition-colors"
          >
            <svg className="w-4 h-4 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            回收站
          </a>
          {user?.role === "admin" && (
            <Link
              href="/admin/users"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3.5 py-2.5 text-sm text-ink hover:bg-surface-hover transition-colors"
            >
              <svg className="w-4 h-4 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              管理用户
            </Link>
          )}
          {user?.role === "admin" && (
            <Link
              href="/admin/announcements"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3.5 py-2.5 text-sm text-ink hover:bg-surface-hover transition-colors"
            >
              <svg className="w-4 h-4 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
              </svg>
              更新公告
            </Link>
          )}
          {user?.role === "admin" && (
            <Link
              href="/admin/feedback"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3.5 py-2.5 text-sm text-ink hover:bg-surface-hover transition-colors"
            >
              <svg className="w-4 h-4 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              用户反馈
            </Link>
          )}
          <button
            onClick={() => {
              setOpen(false);
              setChangePwOpen(true);
            }}
            className="flex items-center gap-2 w-full px-3.5 py-2.5 text-sm text-ink hover:bg-surface-hover transition-colors"
          >
            <svg className="w-4 h-4 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            修改密码
          </button>
          <button
            onClick={() => {
              setOpen(false);
              setFeedbackOpen(true);
            }}
            className="flex items-center gap-2 w-full px-3.5 py-2.5 text-sm text-ink hover:bg-surface-hover transition-colors"
          >
            <svg className="w-4 h-4 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            反馈问题
          </button>
          {!isTauri() && (
            <Link
              href={DESKTOP_APP_DOWNLOAD_PAGE_URL}
              onClick={() => setOpen(false)}
              className="hidden md:flex items-center gap-2 w-full px-3.5 py-2.5 text-sm text-ink hover:bg-surface-hover transition-colors"
            >
              <svg className="w-4 h-4 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              下载桌面版
            </Link>
          )}
          <div className="px-3.5 pt-2 pb-1 text-[11px] text-ink-muted">外观</div>
          <button
            onClick={() => setTheme("dark")}
            className={`flex items-center gap-2 w-full px-3.5 py-2 text-sm transition-colors ${theme === "dark" ? "text-ink bg-surface-active" : "text-ink-muted hover:text-ink hover:bg-surface-hover"}`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
            暗色
            {theme === "dark" && (
              <svg className="ml-auto w-4 h-4 text-ink-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
          <button
            onClick={() => setTheme("light")}
            className={`flex items-center gap-2 w-full px-3.5 py-2 text-sm transition-colors ${theme === "light" ? "text-ink bg-surface-active" : "text-ink-muted hover:text-ink hover:bg-surface-hover"}`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            亮色
            {theme === "light" && (
              <svg className="ml-auto w-4 h-4 text-ink-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
          <div className="my-1 h-px bg-border-light/60" />
          <button
            onClick={handleLogoutClick}
            className="flex items-center gap-2 w-full px-3.5 py-2.5 text-sm text-danger hover:bg-surface-hover transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            退出登录
          </button>
        </div>
      )}

      <ConfirmDialog
        open={logoutConfirmOpen}
        title="退出登录"
        message="还有未同步内容，退出登录可能导致本地草稿无法同步。确定退出？"
        confirmLabel="退出"
        onConfirm={() => {
          setLogoutConfirmOpen(false);
          void handleLogout();
        }}
        onCancel={() => setLogoutConfirmOpen(false)}
      />

      <ChangePasswordModal
        open={changePwOpen}
        onClose={() => setChangePwOpen(false)}
      />

      <ChangeAvatarModal
        open={changeAvatarOpen}
        user={user}
        onClose={() => setChangeAvatarOpen(false)}
        onUserUpdated={(updated) => setUser(updated)}
      />

      <FeedbackModal
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
      />
    </div>
  );
}
