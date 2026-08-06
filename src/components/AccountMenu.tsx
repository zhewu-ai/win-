"use client";

import { useState, useRef, useEffect } from "react";
import { useTheme } from "@/hooks/useTheme";
import { useSyncStatus } from "@/hooks/useSyncStatus";
import ConfirmDialog from "./ConfirmDialog";

interface Props {
  /** Tailwind classes for dropdown position, e.g. "top-full mt-1.5" (opens down) or "bottom-full mb-1.5" (opens up). */
  dropdownPos?: string;
}

export default function AccountMenu({
  dropdownPos = "top-full mt-1.5",
}: Props) {
  const [open, setOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { theme, setTheme } = useTheme();
  const { pendingCount } = useSyncStatus();

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

  return (
    <div className="relative flex-shrink-0" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 pl-1 pr-1.5 py-1 text-ink-muted hover:text-ink hover:bg-surface-hover rounded-btn transition-colors"
        title="账户菜单"
        aria-expanded={open}
      >
        <span className="w-7 h-7 rounded-full bg-surface-strong text-ink-secondary text-sm font-bold flex items-center justify-center">
          我
        </span>
        <span className="hidden sm:inline text-sm font-medium">个人便签</span>
        <svg className="hidden sm:block w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className={`absolute right-0 w-48 py-1 bg-toolbar-bg border border-border-light rounded-card shadow-xl z-20 ${dropdownPos}`}>
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
    </div>
  );
}
