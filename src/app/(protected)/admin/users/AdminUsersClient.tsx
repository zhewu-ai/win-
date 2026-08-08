"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import ConfirmDialog from "@/components/ConfirmDialog";
import UserAvatar from "@/components/UserAvatar";
import type { AdminInvite } from "@/types";
import { formatLastActiveAt } from "@/lib/format-time";

interface AdminUser {
  id: string;
  username: string;
  email: string | null;
  displayName: string | null;
  avatarColor: string | null;
  avatarUrl: string | null;
  role: "admin" | "user";
  status: "active" | "disabled";
  storageQuotaBytes: number;
  storageUsedBytes: number;
  createdAt: string;
  updatedAt: string;
  lastActiveAt: string | null;
  lastActiveAction: string | null;
  activityCounts: {
    today: number;
    last7Days: number;
  };
  _count: {
    notes: number;
    attachments: number;
    feedbackTickets: number;
    announcementReads: number;
  };
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  const mb = bytes / (1024 * 1024);
  return `${mb >= 10 ? mb.toFixed(0) : mb.toFixed(1)} MB`;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const QUOTA_PRESETS_MB = [10, 50, 100, 500];

const INVITE_STATUS: Record<AdminInvite["status"], string> = {
  active: "bg-accent-green/15 text-accent-green",
  used: "bg-accent-blue/15 text-accent-blue",
  revoked: "bg-danger/15 text-danger",
  expired: "bg-surface-active text-ink-muted",
};

const INVITE_STATUS_TEXT: Record<AdminInvite["status"], string> = {
  active: "未使用",
  used: "已使用",
  revoked: "已作废",
  expired: "已过期",
};

const ACTION_TEXT: Record<string, string> = {
  login: "登录",
  create_note: "新建便签",
  edit_note: "编辑便签",
  check_todo: "勾选待办",
  delete_note: "删除便签",
  restore_note: "恢复便签",
  archive_note: "归档便签",
  unarchive_note: "取消归档",
  permanent_delete_note: "永久删除便签",
  upload_attachment: "上传附件",
  delete_attachment: "删除附件",
  submit_feedback: "提交反馈",
  read_announcement: "阅读公告",
  change_avatar: "更换头像",
  change_password: "修改密码",
};

export default function AdminUsersClient({
  currentUserId,
}: {
  currentUserId: string;
}) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [disableTarget, setDisableTarget] = useState<AdminUser | null>(null);
  const [disableBusy, setDisableBusy] = useState(false);

  // 删除废用户（仅 disabled + 非 admin + 非本人 + 无业务数据）
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteInputValue, setDeleteInputValue] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const [quotaTarget, setQuotaTarget] = useState<AdminUser | null>(null);
  const [quotaInput, setQuotaInput] = useState("");
  const [quotaError, setQuotaError] = useState<string | null>(null);
  const [quotaBusy, setQuotaBusy] = useState(false);

  const [pwTarget, setPwTarget] = useState<AdminUser | null>(null);
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);

  const [invites, setInvites] = useState<AdminInvite[]>([]);
  const [newInvite, setNewInvite] = useState<{
    id: string;
    code: string;
    expiresAt: string;
  } | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      if (!res.ok) {
        setLoadError(data.error || "加载失败");
        return;
      }
      setUsers(data.users || []);
    } catch {
      setLoadError("加载失败，请检查网络");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  const fetchInvites = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/invites");
      const data = await res.json();
      if (res.ok && data.invites) setInvites(data.invites);
    } catch {
      // 邀请码加载失败不阻塞用户列表
    }
  }, []);

  useEffect(() => {
    void fetchInvites();
  }, [fetchInvites]);

  const handleGenerate = async () => {
    setInviteBusy(true);
    setInviteError(null);
    try {
      const res = await fetch("/api/admin/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expiresInDays: 7 }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setInviteError(data.error || "生成失败");
        return;
      }
      setNewInvite(data.invite);
      void fetchInvites();
    } catch {
      setInviteError("生成失败，请检查网络");
    } finally {
      setInviteBusy(false);
    }
  };

  const revokeInvite = async (inv: AdminInvite) => {
    try {
      const res = await fetch(`/api/admin/invites/${inv.id}/revoke`, {
        method: "PATCH",
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        alert(data.message || data.error || "作废失败");
        return;
      }
      void fetchInvites();
    } catch {
      alert("作废失败，请检查网络");
    }
  };

  const confirmDisable = async () => {
    if (!disableTarget) return;
    setDisableBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${disableTarget.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "disabled" }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.message || data.error || "禁用失败");
        return;
      }
      setUsers((prev) =>
        prev.map((u) =>
          u.id === disableTarget.id
            ? {
                ...data.user,
                lastActiveAt: u.lastActiveAt,
                lastActiveAction: u.lastActiveAction,
                activityCounts: u.activityCounts,
                _count: u._count,
              }
            : u
        )
      );
    } catch {
      alert("禁用失败，请检查网络");
    } finally {
      setDisableBusy(false);
      setDisableTarget(null);
    }
  };

  const toggleEnable = async (user: AdminUser) => {
    try {
      const res = await fetch(`/api/admin/users/${user.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "active" }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.message || data.error || "启用失败");
        return;
      }
      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id
            ? {
                ...data.user,
                lastActiveAt: u.lastActiveAt,
                lastActiveAction: u.lastActiveAction,
                activityCounts: u.activityCounts,
                _count: u._count,
              }
            : u
        )
      );
    } catch {
      alert("启用失败，请检查网络");
    }
  };

  const openDelete = (user: AdminUser) => {
    setDeleteTarget(user);
    setDeleteConfirmOpen(false);
    setDeleteInputValue("");
    setDeleteError(null);
  };

  const closeDelete = () => {
    setDeleteTarget(null);
    setDeleteConfirmOpen(false);
    setDeleteInputValue("");
    setDeleteError(null);
  };

  const confirmDeleteUser = async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/admin/users/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setDeleteError(data?.message || data?.error || "删除失败");
        return;
      }
      setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id));
      closeDelete();
    } catch {
      setDeleteError("删除失败，请检查网络");
    } finally {
      setDeleteBusy(false);
    }
  };

  const openQuota = (user: AdminUser) => {
    setQuotaTarget(user);
    setQuotaInput(String(Math.round(user.storageQuotaBytes / (1024 * 1024))));
    setQuotaError(null);
  };

  const saveQuota = async () => {
    if (!quotaTarget) return;
    const mb = Number(quotaInput);
    if (!Number.isInteger(mb) || mb <= 0) {
      setQuotaError("请输入有效的整数 MB");
      return;
    }
    const bytes = mb * 1024 * 1024;
    if (bytes > 500 * 1024 * 1024) {
      setQuotaError("额度不能超过 500 MB");
      return;
    }
    if (bytes < quotaTarget.storageUsedBytes) {
      setQuotaError("新额度不能低于当前已用空间");
      return;
    }
    setQuotaBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${quotaTarget.id}/quota`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storageQuotaBytes: bytes }),
      });
      const data = await res.json();
      if (!res.ok) {
        setQuotaError(data.message || data.error || "调整失败");
        return;
      }
      setUsers((prev) =>
        prev.map((u) =>
          u.id === quotaTarget.id
            ? {
                ...data.user,
                lastActiveAt: u.lastActiveAt,
                lastActiveAction: u.lastActiveAction,
                activityCounts: u.activityCounts,
                _count: u._count,
              }
            : u
        )
      );
      setQuotaTarget(null);
    } catch {
      setQuotaError("调整失败，请检查网络");
    } finally {
      setQuotaBusy(false);
    }
  };

  const openPw = (user: AdminUser) => {
    setPwTarget(user);
    setPw1("");
    setPw2("");
    setPwError(null);
    setPwSuccess(false);
  };

  const savePw = async () => {
    if (!pwTarget) return;
    if (pw1.length < 8) {
      setPwError("密码至少 8 位");
      return;
    }
    if (pw1 !== pw2) {
      setPwError("两次输入不一致");
      return;
    }
    setPwBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${pwTarget.id}/password`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: pw1 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPwError(data.message || data.error || "重置失败");
        return;
      }
      setPwSuccess(true);
    } catch {
      setPwError("重置失败，请检查网络");
    } finally {
      setPwBusy(false);
    }
  };

  const q = search.trim().toLowerCase();
  const filteredUsers = users.filter((u) => {
    if (!q) return true;
    return (
      (u.email || "").toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      (u.displayName || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col h-full">
      {/* 顶栏 */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border-light bg-toolbar-bg z-10 min-h-[52px] flex-shrink-0">
        <Link
          href="/"
          className="flex items-center gap-1 text-sm text-ink-muted hover:text-ink transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          返回
        </Link>
        <h1 className="text-sm font-semibold text-ink">用户管理</h1>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin [scrollbar-gutter:stable] p-4">
        {loading && (
          <p className="text-sm text-ink-muted py-6 text-center">加载中…</p>
        )}
        {!loading && loadError && (
          <div className="text-sm text-danger py-6 text-center">
            {loadError}
            <button
              onClick={() => void fetchUsers()}
              className="ml-2 underline hover:text-ink"
            >
              重试
            </button>
          </div>
        )}
        {!loading && !loadError && users.length === 0 && (
          <p className="text-sm text-ink-muted py-6 text-center">暂无用户</p>
        )}

        {!loading && !loadError && users.length > 0 && (
          <>
            <div className="max-w-2xl">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索邮箱 / 用户名 / 昵称"
                className="w-full px-3 py-2 text-sm text-ink bg-search-bg border border-border-soft rounded-input outline-none focus:bg-surface-focus focus:border-surface-focus focus:ring-1 focus:ring-surface-focus transition-all placeholder:text-ink-muted/60"
              />
            </div>
            {filteredUsers.length === 0 ? (
              <p className="text-sm text-ink-muted py-6 text-center">
                无匹配用户
              </p>
            ) : (
              <ul className="mt-3 space-y-2 max-w-2xl">
                {filteredUsers.map((u) => {
              const isSelf = u.id === currentUserId;
              const displayName = u.displayName || u.username;
              return (
                <li
                  key={u.id}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 px-3.5 py-3 bg-toolbar-bg border border-border-light rounded-card"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <UserAvatar user={u} size="md" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-ink truncate">
                          {displayName}
                        </span>
                        {u.role === "admin" && (
                          <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-accent-blue/15 text-accent-blue">
                            管理员
                          </span>
                        )}
                        <span
                          className={`flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-full ${
                            u.status === "active"
                              ? "bg-accent-green/15 text-accent-green"
                              : "bg-danger/15 text-danger"
                          }`}
                        >
                          {u.status === "active" ? "正常" : "已禁用"}
                        </span>
                      </div>
                      <p className="text-[11px] text-ink-muted truncate">
                        {u.email || `@${u.username}`} · 已用{" "}
                        {formatBytes(u.storageUsedBytes)} /{" "}
                        {formatBytes(u.storageQuotaBytes)}
                      </p>
                      <p className="text-[11px] text-ink-muted/70 break-words">
                        创建于 {formatDateTime(u.createdAt)} · 活跃{" "}
                        {formatLastActiveAt(u.lastActiveAt)}
                        {u.lastActiveAction
                          ? ` · ${ACTION_TEXT[u.lastActiveAction] || u.lastActiveAction}`
                          : ""}{" "}
                        · 今日 {u.activityCounts.today} 次 · 近7天{" "}
                        {u.activityCounts.last7Days} 次
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {u.status === "active" ? (
                      <button
                        onClick={() => setDisableTarget(u)}
                        disabled={isSelf}
                        className="px-2.5 py-1.5 text-xs font-medium text-danger rounded-btn hover:bg-danger/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        title={isSelf ? "不能禁用自己" : "禁用该用户"}
                      >
                        禁用
                      </button>
                    ) : (
                      <button
                        onClick={() => void toggleEnable(u)}
                        className="px-2.5 py-1.5 text-xs font-medium text-accent-green rounded-btn hover:bg-accent-green/10 transition-colors"
                      >
                        启用
                      </button>
                    )}
                    <button
                      onClick={() => openQuota(u)}
                      className="px-2.5 py-1.5 text-xs font-medium text-ink-secondary rounded-btn hover:bg-surface-hover transition-colors"
                    >
                      调整额度
                    </button>
                    <button
                      onClick={() => openPw(u)}
                      className="px-2.5 py-1.5 text-xs font-medium text-ink-secondary rounded-btn hover:bg-surface-hover transition-colors"
                    >
                      重置密码
                    </button>
                    {u.status === "disabled" && u.role === "user" && !isSelf && (
                      <>
                        <span className="w-px h-4 bg-border-light" aria-hidden="true" />
                        <button
                          onClick={() => openDelete(u)}
                          className="px-2 py-1 text-[11px] font-normal text-ink-muted/70 hover:text-danger hover:bg-danger/5 rounded-btn transition-colors"
                          title="删除已禁用的普通用户，并级联清理其个人数据"
                        >
                          删除用户
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
                })}
              </ul>
            )}
          </>
        )}

        {/* 邀请码 */}
        <div className="mt-8 max-w-2xl">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-ink">邀请码</h2>
            <button
              onClick={() => void handleGenerate()}
              disabled={inviteBusy}
              className="px-2.5 py-1.5 text-xs font-medium text-white bg-primary rounded-btn hover:brightness-110 active:brightness-95 disabled:opacity-50 transition-all"
            >
              {inviteBusy ? "生成中…" : "生成邀请码"}
            </button>
          </div>
          <p className="mt-1 text-[11px] text-ink-muted">
            邀请码单次使用、7 天有效。生成后请复制给需要注册的用户。
          </p>

          {inviteError && (
            <p className="mt-2 text-[11px] text-danger">{inviteError}</p>
          )}

          {newInvite && (
            <div className="mt-3 p-3 bg-accent-green/10 border border-accent-green/30 rounded-card">
              <p className="text-xs font-medium text-ink">
                邀请码只显示一次，请现在复制给用户。
              </p>
              <code className="mt-1.5 block text-sm font-mono font-semibold tracking-wide text-ink break-all">
                {newInvite.code}
              </code>
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <p className="text-[11px] text-ink-muted">
                  过期时间：{formatDateTime(newInvite.expiresAt)}
                </p>
                <button
                  onClick={() => setNewInvite(null)}
                  className="text-[11px] font-medium text-ink-secondary hover:text-ink underline"
                >
                  知道了
                </button>
              </div>
            </div>
          )}

          <ul className="mt-3 space-y-1.5">
            {invites.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center gap-2 px-3 py-2 bg-toolbar-bg border border-border-light rounded-card"
              >
                <span
                  className={`flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-full ${INVITE_STATUS[inv.status]}`}
                >
                  {INVITE_STATUS_TEXT[inv.status]}
                </span>
                <span className="text-[11px] text-ink-secondary min-w-0 truncate">
                  创建于 {formatDateTime(inv.createdAt)} · 过期{" "}
                  {formatDateTime(inv.expiresAt)}
                  {inv.usedBy &&
                    ` · 使用人 ${inv.usedBy.displayName || inv.usedBy.username}`}
                </span>
                {inv.status === "active" && (
                  <button
                    onClick={() => void revokeInvite(inv)}
                    className="ml-auto flex-shrink-0 text-[11px] font-medium text-danger hover:bg-danger/10 rounded-btn px-1.5 py-0.5 transition-colors"
                  >
                    作废
                  </button>
                )}
              </li>
            ))}
            {invites.length === 0 && (
              <li className="text-[11px] text-ink-muted py-1">暂无邀请码</li>
            )}
          </ul>
        </div>
      </div>

      {/* 禁用二次确认 */}
      <ConfirmDialog
        open={disableTarget !== null}
        title="禁用用户"
        message={`禁用后，该用户（${disableTarget?.displayName || disableTarget?.username || ""}）将无法登录和访问便签。确认禁用？`}
        confirmLabel={disableBusy ? "禁用中…" : "禁用"}
        onConfirm={() => void confirmDisable()}
        onCancel={() => setDisableTarget(null)}
      />

      {/* 调整额度 */}
      {quotaTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => !quotaBusy && setQuotaTarget(null)}
        >
          <div
            className="w-full max-w-[360px] rounded-modal bg-toolbar-bg border border-border-light shadow-2xl p-5"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <h3 className="text-base font-bold text-ink">调整额度</h3>
            <p className="mt-1.5 text-xs text-ink-muted">
              {quotaTarget.displayName || quotaTarget.username} · 当前已用{" "}
              {formatBytes(quotaTarget.storageUsedBytes)} · 当前额度{" "}
              {formatBytes(quotaTarget.storageQuotaBytes)}
            </p>
            <div className="mt-3 flex gap-1.5 flex-wrap">
              {QUOTA_PRESETS_MB.map((mb) => (
                <button
                  key={mb}
                  onClick={() => setQuotaInput(String(mb))}
                  className={`px-2.5 py-1 text-xs font-medium rounded-btn transition-colors ${
                    quotaInput === String(mb)
                      ? "bg-primary text-white"
                      : "text-ink-secondary bg-surface-hover hover:bg-surface-active"
                  }`}
                >
                  {mb} MB
                </button>
              ))}
            </div>
            <div className="mt-3">
              <label className="text-[11px] text-ink-muted">
                新额度（MB）
              </label>
              <input
                value={quotaInput}
                onChange={(e) => setQuotaInput(e.target.value)}
                inputMode="numeric"
                placeholder="如 50"
                className="mt-1 w-full px-2.5 py-1.5 text-sm text-ink bg-search-bg border border-border-soft rounded-input outline-none focus:border-surface-focus focus:ring-1 focus:ring-surface-focus transition-all placeholder:text-ink-muted/60"
              />
            </div>
            {quotaError && (
              <p className="mt-1.5 text-[11px] text-danger">{quotaError}</p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setQuotaTarget(null)}
                disabled={quotaBusy}
                className="px-3.5 py-1.5 rounded-btn text-sm font-semibold text-ink-secondary hover:text-ink hover:bg-surface-hover transition-colors disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={() => void saveQuota()}
                disabled={quotaBusy}
                className="px-3.5 py-1.5 rounded-btn text-sm font-semibold text-white bg-primary hover:brightness-110 active:brightness-95 disabled:opacity-50 transition-all"
              >
                {quotaBusy ? "保存中…" : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 重置密码 */}
      {pwTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => !pwBusy && setPwTarget(null)}
        >
          <div
            className="w-full max-w-[360px] rounded-modal bg-toolbar-bg border border-border-light shadow-2xl p-5"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <h3 className="text-base font-bold text-ink">重置密码</h3>
            <p className="mt-1.5 text-xs text-ink-muted">
              为 {pwTarget.displayName || pwTarget.username} 设置新密码
            </p>
            {pwSuccess ? (
              <p className="mt-4 text-sm font-medium text-accent-green">
                密码已重置
              </p>
            ) : (
              <>
                <div className="mt-3">
                  <input
                    type="password"
                    value={pw1}
                    onChange={(e) => setPw1(e.target.value)}
                    placeholder="新密码（至少 8 位）"
                    autoFocus
                    className="w-full px-2.5 py-1.5 text-sm text-ink bg-search-bg border border-border-soft rounded-input outline-none focus:border-surface-focus focus:ring-1 focus:ring-surface-focus transition-all placeholder:text-ink-muted/60"
                  />
                </div>
                <div className="mt-2">
                  <input
                    type="password"
                    value={pw2}
                    onChange={(e) => setPw2(e.target.value)}
                    placeholder="再次确认新密码"
                    className="w-full px-2.5 py-1.5 text-sm text-ink bg-search-bg border border-border-soft rounded-input outline-none focus:border-surface-focus focus:ring-1 focus:ring-surface-focus transition-all placeholder:text-ink-muted/60"
                  />
                </div>
                {pwError && (
                  <p className="mt-1.5 text-[11px] text-danger">{pwError}</p>
                )}
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    onClick={() => setPwTarget(null)}
                    disabled={pwBusy}
                    className="px-3.5 py-1.5 rounded-btn text-sm font-semibold text-ink-secondary hover:text-ink hover:bg-surface-hover transition-colors disabled:opacity-50"
                  >
                    取消
                  </button>
                  <button
                    onClick={() => void savePw()}
                    disabled={pwBusy}
                    className="px-3.5 py-1.5 rounded-btn text-sm font-semibold text-white bg-primary hover:brightness-110 active:brightness-95 disabled:opacity-50 transition-all"
                  >
                    {pwBusy ? "重置中…" : "重置密码"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 删除废用户：第一层确认 */}
      <ConfirmDialog
        open={deleteTarget !== null && !deleteConfirmOpen}
        title="删除用户"
        message={`删除用户后不可恢复。此操作会同时清理该用户的便签、附件、反馈记录和公告已读记录。\n\n确认删除用户「${
          deleteTarget?.displayName || deleteTarget?.username || ""
        }」？`}
        confirmLabel="下一步"
        onConfirm={() => setDeleteConfirmOpen(true)}
        onCancel={() => closeDelete()}
      />

      {/* 删除废用户：第二层输入确认 */}
      {deleteTarget && deleteConfirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => !deleteBusy && closeDelete()}
        >
          <div
            className="w-full max-w-[360px] rounded-modal bg-toolbar-bg border border-border-light shadow-2xl p-5"
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
          >
            <h3 className="text-base font-bold text-ink">确认删除</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
              将永久删除该用户及其{" "}
              {deleteTarget._count?.notes ?? 0} 条便签、{" "}
              {deleteTarget._count?.attachments ?? 0} 个附件、{" "}
              {deleteTarget._count?.feedbackTickets ?? 0} 条反馈记录、{" "}
              {deleteTarget._count?.announcementReads ?? 0} 条公告已读记录。
            </p>
            <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
              请输入
              <span className="font-mono font-semibold text-danger"> DELETE </span>
              {deleteTarget.email
                ? "或该用户邮箱，确认永久删除。"
                : "，确认永久删除。"}
            </p>
            <input
              type="text"
              value={deleteInputValue}
              onChange={(e) => setDeleteInputValue(e.target.value)}
              autoFocus
              placeholder={deleteTarget.email || "DELETE"}
              className="mt-3 w-full px-3 py-2 text-sm rounded-input bg-search-bg border border-border-light outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 placeholder:text-ink-muted/60"
            />
            {deleteError && (
              <p className="mt-2 text-[11px] text-danger break-words">
                {deleteError}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => closeDelete()}
                disabled={deleteBusy}
                className="px-3.5 py-1.5 rounded-btn text-sm font-semibold text-ink-secondary hover:text-ink hover:bg-surface-hover transition-colors disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={() => void confirmDeleteUser()}
                disabled={
                  deleteBusy ||
                  !(
                    deleteInputValue === "DELETE" ||
                    (!!deleteTarget.email &&
                      deleteInputValue.toLowerCase() ===
                        deleteTarget.email.toLowerCase())
                  )
                }
                className="px-3.5 py-1.5 rounded-btn text-sm font-semibold text-white bg-danger hover:bg-danger/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {deleteBusy ? "删除中…" : "永久删除"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}