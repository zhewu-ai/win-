"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import ConfirmDialog from "@/components/ConfirmDialog";

interface ReadUser {
  id: string;
  username: string;
  email: string | null;
  displayName: string | null;
}

interface AdminAnnouncement {
  id: string;
  title: string;
  content: string;
  version: string | null;
  status: "draft" | "published" | "archived";
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  readCount: number;
  activeUserCount: number;
  reads: { id: string; readAt: string; user: ReadUser }[];
}

const STATUS_BADGE: Record<
  AdminAnnouncement["status"],
  { text: string; cls: string }
> = {
  draft: { text: "草稿", cls: "bg-surface-active text-ink-muted" },
  published: { text: "已发布", cls: "bg-accent-green/15 text-accent-green" },
  archived: { text: "已归档", cls: "bg-danger/15 text-danger" },
};

function formatDateTime(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AdminAnnouncementsClient() {
  const [announcements, setAnnouncements] = useState<AdminAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // 新建草稿表单
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newVersion, setNewVersion] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [createBusy, setCreateBusy] = useState(false);

  // 编辑草稿表单
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editVersion, setEditVersion] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [editBusy, setEditBusy] = useState(false);

  // 发布/归档确认
  const [publishTarget, setPublishTarget] = useState<AdminAnnouncement | null>(
    null
  );
  const [archiveTarget, setArchiveTarget] = useState<AdminAnnouncement | null>(
    null
  );
  const [actionBusy, setActionBusy] = useState(false);

  const [expandedReadsId, setExpandedReadsId] = useState<string | null>(null);

  const fetchAnnouncements = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/admin/announcements");
      const data = await res.json();
      if (!res.ok) {
        setLoadError(data.message || data.error || "加载失败");
        return;
      }
      setAnnouncements(data.announcements || []);
    } catch {
      setLoadError("加载失败，请检查网络");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAnnouncements();
  }, [fetchAnnouncements]);

  const openCreate = () => {
    setCreating(true);
    setNewTitle("");
    setNewContent("");
    setNewVersion("");
    setCreateError(null);
  };

  const saveCreate = async () => {
    if (!newTitle.trim() || !newContent.trim()) {
      setCreateError("标题和正文不能为空");
      return;
    }
    setCreateBusy(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/admin/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          content: newContent,
          version: newVersion,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.message || data.error || "新建失败");
        return;
      }
      setCreating(false);
      void fetchAnnouncements();
    } catch {
      setCreateError("新建失败，请检查网络");
    } finally {
      setCreateBusy(false);
    }
  };

  const openEdit = (a: AdminAnnouncement) => {
    setEditingId(a.id);
    setEditTitle(a.title);
    setEditContent(a.content);
    setEditVersion(a.version || "");
    setEditError(null);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    if (!editTitle.trim() || !editContent.trim()) {
      setEditError("标题和正文不能为空");
      return;
    }
    setEditBusy(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/admin/announcements/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle,
          content: editContent,
          version: editVersion,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEditError(data.message || data.error || "保存失败");
        return;
      }
      setEditingId(null);
      void fetchAnnouncements();
    } catch {
      setEditError("保存失败，请检查网络");
    } finally {
      setEditBusy(false);
    }
  };

  const confirmPublish = async () => {
    if (!publishTarget) return;
    setActionBusy(true);
    try {
      const res = await fetch(
        `/api/admin/announcements/${publishTarget.id}/publish`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok) {
        alert(data.message || data.error || "发布失败");
      }
      setPublishTarget(null);
      void fetchAnnouncements();
    } catch {
      alert("发布失败，请检查网络");
    } finally {
      setActionBusy(false);
    }
  };

  const confirmArchive = async () => {
    if (!archiveTarget) return;
    setActionBusy(true);
    try {
      const res = await fetch(
        `/api/admin/announcements/${archiveTarget.id}/archive`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok) {
        alert(data.message || data.error || "归档失败");
      }
      setArchiveTarget(null);
      void fetchAnnouncements();
    } catch {
      alert("归档失败，请检查网络");
    } finally {
      setActionBusy(false);
    }
  };

  const inputCls =
    "w-full px-2.5 py-1.5 text-sm text-ink bg-search-bg border border-border-soft rounded-input outline-none focus:border-surface-focus focus:ring-1 focus:ring-surface-focus transition-all placeholder:text-ink-muted/60";
  const textareaCls =
    "w-full px-2.5 py-1.5 text-sm text-ink bg-search-bg border border-border-soft rounded-input outline-none focus:border-surface-focus focus:ring-1 focus:ring-surface-focus transition-all placeholder:text-ink-muted/60 resize-y";

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
        <h1 className="text-sm font-semibold text-ink">更新公告</h1>
        <div className="flex-1" />
        <button
          onClick={openCreate}
          disabled={creating}
          className="px-3 py-1.5 text-xs font-medium text-white bg-primary rounded-btn hover:brightness-110 active:brightness-95 disabled:opacity-50 transition-all"
        >
          {creating ? "编辑中…" : "新建公告"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin [scrollbar-gutter:stable] p-4">
        {loading && (
          <p className="text-sm text-ink-muted py-6 text-center">加载中…</p>
        )}
        {!loading && loadError && (
          <div className="text-sm text-danger py-6 text-center">
            {loadError}
            <button
              onClick={() => void fetchAnnouncements()}
              className="ml-2 underline hover:text-ink"
            >
              重试
            </button>
          </div>
        )}
        {!loading && !loadError && (
          <div className="max-w-2xl space-y-4">
            {/* 新建草稿表单 */}
            {creating && (
              <div className="p-4 bg-toolbar-bg border border-border-light rounded-card">
                <h2 className="text-sm font-semibold text-ink">新建公告草稿</h2>
                <p className="mt-1 text-[11px] text-ink-muted">
                  由管理员手写内容并发布，系统不会自动生成或发布公告。
                </p>
                <div className="mt-3 space-y-3">
                  <div>
                    <label className="text-[11px] text-ink-muted">标题</label>
                    <input
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="公告标题"
                      className={`${inputCls} mt-1`}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-ink-muted">
                      版本号（可选，如 M10.10）
                    </label>
                    <input
                      value={newVersion}
                      onChange={(e) => setNewVersion(e.target.value)}
                      placeholder="如 M10.10"
                      className={`${inputCls} mt-1`}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-ink-muted">正文</label>
                    <textarea
                      value={newContent}
                      onChange={(e) => setNewContent(e.target.value)}
                      rows={6}
                      placeholder="公告内容（支持多行）"
                      className={`${textareaCls} mt-1`}
                    />
                  </div>
                  {createError && (
                    <p className="text-[11px] text-danger">{createError}</p>
                  )}
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setCreating(false)}
                      disabled={createBusy}
                      className="px-3.5 py-1.5 rounded-btn text-sm font-semibold text-ink-secondary hover:text-ink hover:bg-surface-hover transition-colors disabled:opacity-50"
                    >
                      取消
                    </button>
                    <button
                      onClick={() => void saveCreate()}
                      disabled={createBusy}
                      className="px-3.5 py-1.5 rounded-btn text-sm font-semibold text-white bg-primary hover:brightness-110 active:brightness-95 disabled:opacity-50 transition-all"
                    >
                      {createBusy ? "保存中…" : "保存草稿"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {announcements.length === 0 && !creating && (
              <p className="text-sm text-ink-muted py-6 text-center">
                暂无公告，点击右上角「新建公告」创建第一条。
              </p>
            )}

            {announcements.map((a) => {
              const readRate =
                a.activeUserCount > 0
                  ? Math.min(100, Math.round((a.readCount / a.activeUserCount) * 100))
                  : 0;
              const unread = Math.max(0, a.activeUserCount - a.readCount);
              const badge = STATUS_BADGE[a.status];
              return (
                <div
                  key={a.id}
                  className="p-4 bg-toolbar-bg border border-border-light rounded-card"
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={`flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-full ${badge.cls}`}
                    >
                      {badge.text}
                    </span>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-ink break-words">
                        {a.title}
                      </h3>
                      <p className="text-[11px] text-ink-muted mt-0.5">
                        {a.version ? `版本 ${a.version} · ` : ""}
                        {a.status === "published"
                          ? `发布于 ${formatDateTime(a.publishedAt)}`
                          : `创建于 ${formatDateTime(a.createdAt)}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {a.status === "draft" && (
                        <button
                          onClick={() => openEdit(a)}
                          className="px-2 py-1 text-xs font-medium text-ink-secondary hover:bg-surface-hover rounded-btn transition-colors"
                        >
                          编辑
                        </button>
                      )}
                      {a.status === "draft" && (
                        <button
                          onClick={() => setPublishTarget(a)}
                          className="px-2 py-1 text-xs font-medium text-white bg-primary rounded-btn hover:brightness-110 active:brightness-95 transition-all"
                        >
                          发布
                        </button>
                      )}
                      {a.status === "published" && (
                        <button
                          onClick={() => setArchiveTarget(a)}
                          className="px-2 py-1 text-xs font-medium text-danger hover:bg-danger/10 rounded-btn transition-colors"
                        >
                          归档
                        </button>
                      )}
                    </div>
                  </div>

                  {editingId === a.id ? (
                    <div className="mt-3 space-y-3">
                      <div>
                        <label className="text-[11px] text-ink-muted">标题</label>
                        <input
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className={`${inputCls} mt-1`}
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-ink-muted">版本号</label>
                        <input
                          value={editVersion}
                          onChange={(e) => setEditVersion(e.target.value)}
                          placeholder="如 M10.10"
                          className={`${inputCls} mt-1`}
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-ink-muted">正文</label>
                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          rows={6}
                          className={`${textareaCls} mt-1`}
                        />
                      </div>
                      {editError && (
                        <p className="text-[11px] text-danger">{editError}</p>
                      )}
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setEditingId(null)}
                          disabled={editBusy}
                          className="px-3.5 py-1.5 rounded-btn text-sm font-semibold text-ink-secondary hover:text-ink hover:bg-surface-hover transition-colors disabled:opacity-50"
                        >
                          取消
                        </button>
                        <button
                          onClick={() => void saveEdit()}
                          disabled={editBusy}
                          className="px-3.5 py-1.5 rounded-btn text-sm font-semibold text-white bg-primary hover:brightness-110 active:brightness-95 disabled:opacity-50 transition-all"
                        >
                          {editBusy ? "保存中…" : "保存"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="mt-3 text-sm text-ink whitespace-pre-wrap break-words">
                        {a.content}
                      </p>
                      {a.status === "published" && (
                        <div className="mt-3">
                          <button
                            onClick={() =>
                              setExpandedReadsId(
                                expandedReadsId === a.id ? null : a.id
                              )
                            }
                            className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                          >
                            {expandedReadsId === a.id ? "收起" : "查看"}阅读统计：
                            应看 {a.activeUserCount} · 已读 {a.readCount} · 未读{" "}
                            {unread} · 阅读率 {readRate}%
                          </button>
                          {expandedReadsId === a.id && (
                            <div className="mt-2 max-h-48 overflow-y-auto scrollbar-thin rounded-card bg-surface-hover p-2">
                              {a.reads.length === 0 ? (
                                <p className="text-[11px] text-ink-muted px-1 py-1">
                                  暂无用户阅读
                                </p>
                              ) : (
                                <ul className="space-y-1">
                                  {a.reads.map((r) => (
                                    <li
                                      key={r.id}
                                      className="flex items-center justify-between gap-2 px-1.5 py-1 rounded-md hover:bg-surface-active"
                                    >
                                      <span className="text-xs text-ink truncate">
                                        {r.user.displayName ||
                                          r.user.username}
                                        {r.user.email &&
                                          r.user.email !== r.user.username && (
                                            <span className="text-ink-muted/70">
                                              {" "}
                                              · {r.user.email}
                                            </span>
                                          )}
                                      </span>
                                      <span className="text-[11px] text-ink-muted flex-shrink-0">
                                        {formatDateTime(r.readAt)}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={publishTarget !== null}
        title="发布公告"
        message={`发布后，所有未读用户登录时都会看到「${publishTarget?.title || ""}」。确认发布？`}
        confirmLabel={actionBusy ? "发布中…" : "发布"}
        onConfirm={() => void confirmPublish()}
        onCancel={() => setPublishTarget(null)}
      />

      <ConfirmDialog
        open={archiveTarget !== null}
        title="归档公告"
        message={`归档后「${archiveTarget?.title || ""}」将不再展示给用户，且不可重新发布。确认归档？`}
        confirmLabel={actionBusy ? "归档中…" : "归档"}
        onConfirm={() => void confirmArchive()}
        onCancel={() => setArchiveTarget(null)}
      />
    </div>
  );
}
