"use client";

import { useEffect, useRef, useState } from "react";
import type { User } from "@/types";
import UserAvatar, {
  AVATAR_COLOR_VALUES,
  hashAvatarColor,
} from "./UserAvatar";

const AVATAR_BG: Record<string, string> = {
  yellow: "bg-accent-yellow text-[#20242a]",
  blue: "bg-accent-blue text-white",
  green: "bg-accent-green text-[#20242a]",
  pink: "bg-accent-pink text-[#20242a]",
  gray: "bg-accent-gray text-[#20242a]",
};

interface Props {
  open: boolean;
  user: User | null;
  onClose: () => void;
  onUserUpdated: (user: User) => void;
}

export default function ChangeAvatarModal({
  open,
  user,
  onClose,
  onUserUpdated,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    setError("");
    setSuccess("");
    setBusy(false);
  }, [open]);

  if (!open) return null;

  const displayName = user?.displayName || user?.username || "…";
  const initial = displayName.trim().charAt(0) || "?";
  const avatarBgCls =
    AVATAR_BG[user?.avatarColor || hashAvatarColor(user?.username || "guest")] ||
    AVATAR_BG.gray;

  const upload = async (file: File) => {
    setBusy(true);
    setError("");
    setSuccess("");
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/auth/avatar", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || data.error || "上传失败");
        return;
      }
      onUserUpdated(data.user);
      setSuccess("头像已更新");
    } catch {
      setError("上传失败，请检查网络");
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    void upload(file);
  };

  const removeAvatar = async () => {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/auth/avatar", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || data.error || "移除失败");
        return;
      }
      onUserUpdated(data.user);
      setSuccess("已移除头像，恢复文字头像");
    } catch {
      setError("移除失败，请检查网络");
    } finally {
      setBusy(false);
    }
  };

  const selectColor = async (color: string) => {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarColor: color }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || data.error || "设置失败");
        return;
      }
      onUserUpdated(data.user);
      setSuccess("头像颜色已更新");
    } catch {
      setError("设置失败，请检查网络");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={!busy ? onClose : undefined}
      role="presentation"
    >
      <div
        className="w-full max-w-[360px] rounded-modal bg-toolbar-bg border border-border-light shadow-2xl p-5"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="更换头像"
      >
        <h3 className="text-base font-bold text-ink">更换头像</h3>

        <div className="mt-4 flex items-center gap-3.5">
          {user?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatarUrl}
              alt={displayName}
              className="w-16 h-16 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <span
              className={`w-16 h-16 rounded-full text-2xl font-bold flex-shrink-0 flex items-center justify-center ${avatarBgCls}`}
            >
              {initial}
            </span>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-ink truncate">{displayName}</p>
            <p className="text-[11px] text-ink-muted mt-0.5">
              支持 JPG / PNG / WebP，最大 1MB
            </p>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            className="flex-1 py-1.5 text-xs font-medium text-white bg-primary rounded-btn hover:brightness-110 active:brightness-95 disabled:opacity-50 transition-all"
          >
            上传图片
          </button>
          {user?.avatarUrl && (
            <button
              onClick={() => void removeAvatar()}
              disabled={busy}
              className="flex-1 py-1.5 text-xs font-medium text-danger border border-danger/30 rounded-btn hover:bg-danger/10 disabled:opacity-50 transition-colors"
            >
              移除头像
            </button>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />

        <div className="mt-4">
          <span className="text-[11px] text-ink-muted">头像颜色</span>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {AVATAR_COLOR_VALUES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => void selectColor(c)}
                disabled={busy}
                className={`w-6 h-6 ${AVATAR_BG[c]} rounded-full transition-transform ${
                  (user?.avatarColor || hashAvatarColor(user?.username || "guest")) === c
                    ? "ring-2 ring-ring-selected ring-offset-2 ring-offset-toolbar-bg scale-110"
                    : "hover:scale-110"
                }`}
                title={c}
                aria-label={c}
              />
            ))}
          </div>
        </div>

        {error && <p className="mt-3 text-xs text-danger">{error}</p>}
        {success && (
          <p className="mt-3 text-xs font-medium text-accent-green">{success}</p>
        )}

        <div className="mt-5 flex justify-end">
          <button
            onClick={onClose}
            disabled={busy}
            className="px-3.5 py-1.5 rounded-btn text-sm font-semibold text-white bg-primary hover:brightness-110 transition-colors disabled:opacity-50"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
}
