"use client";

import { useState, useEffect } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
}

const MIN_PASSWORD_LENGTH = 8;

export default function ChangePasswordModal({ open, onClose }: Props) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // 每次打开重置表单
  useEffect(() => {
    if (!open) return;
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError("");
    setSuccess(false);
    setSaving(false);
  }, [open]);

  if (!open) return null;

  const submit = async () => {
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`密码至少 ${MIN_PASSWORD_LENGTH} 位`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("两次输入的密码不一致");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.message || data.error || "修改失败");
        return;
      }
      setSuccess(true);
    } catch {
      setError("修改失败，请检查网络");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-[360px] rounded-modal bg-toolbar-bg border border-border-light shadow-2xl p-5"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="修改密码"
      >
        <h3 className="text-base font-bold text-ink">修改密码</h3>

        {success ? (
          <>
            <p className="mt-3 text-sm font-medium text-primary">密码已修改</p>
            <div className="mt-5 flex justify-end">
              <button
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-btn text-sm font-semibold text-white bg-primary hover:brightness-110 transition-colors"
              >
                完成
              </button>
            </div>
          </>
        ) : (
          <div className="mt-3 space-y-3">
            <label className="block">
              <span className="text-[11px] text-ink-muted">当前密码</span>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="输入当前密码"
                className="mt-1 w-full px-2.5 py-1.5 text-sm text-ink bg-search-bg border border-border-soft rounded-input outline-none focus:border-surface-focus focus:ring-1 focus:ring-surface-focus transition-all placeholder:text-ink-muted/60"
              />
            </label>
            <label className="block">
              <span className="text-[11px] text-ink-muted">新密码</span>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={`至少 ${MIN_PASSWORD_LENGTH} 位`}
                className="mt-1 w-full px-2.5 py-1.5 text-sm text-ink bg-search-bg border border-border-soft rounded-input outline-none focus:border-surface-focus focus:ring-1 focus:ring-surface-focus transition-all placeholder:text-ink-muted/60"
              />
            </label>
            <label className="block">
              <span className="text-[11px] text-ink-muted">确认新密码</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !saving) void submit();
                }}
                placeholder="再次输入新密码"
                className="mt-1 w-full px-2.5 py-1.5 text-sm text-ink bg-search-bg border border-border-soft rounded-input outline-none focus:border-surface-focus focus:ring-1 focus:ring-surface-focus transition-all placeholder:text-ink-muted/60"
              />
            </label>
            {error && <p className="text-xs text-danger">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button
                onClick={submit}
                disabled={saving}
                className="flex-1 py-1.5 text-sm font-medium text-white bg-primary rounded-btn hover:brightness-110 active:brightness-95 disabled:opacity-50 transition-all"
              >
                {saving ? "保存中..." : "保存"}
              </button>
              <button
                onClick={onClose}
                className="flex-1 py-1.5 text-sm text-ink-muted hover:text-ink hover:bg-surface-hover rounded-btn transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
