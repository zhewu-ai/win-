"use client";

import { useEffect, useState } from "react";
import ChangePasswordModal from "@/components/ChangePasswordModal";

/**
 * 管理员重置密码后的轻提示条：看到 mustChangePassword=true 时展示，
 * 不强制跳转、不阻塞便签编辑，可关闭；点击「去修改」打开改密弹窗。
 */
export default function MustChangePasswordBanner() {
  const [mustChange, setMustChange] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [open, setOpen] = useState(false);

  const refresh = async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      if (!res.ok) {
        setMustChange(false);
        return;
      }
      const d = await res.json();
      setMustChange(Boolean(d?.user?.mustChangePassword));
    } catch {
      // 离线等场景不展示提示，也不阻塞页面
      setMustChange(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // 窗口聚焦时刷新：覆盖从账号菜单改密成功后本提示条的同步
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  if (loading || !mustChange || dismissed) return null;

  return (
    <>
      <div
        role="status"
        className="fixed top-3 left-1/2 -translate-x-1/2 z-40 max-w-[92vw] flex items-center gap-2.5 rounded-modal bg-toolbar-bg border border-border-light shadow-2xl px-3.5 py-2"
      >
        <span className="w-2 h-2 rounded-full bg-accent-yellow" />
        <p className="text-xs text-ink-secondary whitespace-nowrap">
          管理员为你重置了密码，请尽快修改。
        </p>
        <button
          onClick={() => setOpen(true)}
          className="text-xs font-semibold text-primary hover:underline whitespace-nowrap"
        >
          去修改
        </button>
        <button
          onClick={() => setDismissed(true)}
          aria-label="关闭提示"
          className="text-ink-muted hover:text-ink text-sm leading-none"
        >
          ×
        </button>
      </div>
      <ChangePasswordModal
        open={open}
        onClose={() => {
          setOpen(false);
          void refresh();
        }}
      />
    </>
  );
}
