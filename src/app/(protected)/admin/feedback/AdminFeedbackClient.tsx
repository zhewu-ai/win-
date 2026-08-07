"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import UserAvatar from "@/components/UserAvatar";
import type { FeedbackStatus, FeedbackType, FeedbackTicket } from "@/types";

const TYPE_TEXT: Record<FeedbackType, string> = {
  bug: "问题",
  feature: "建议",
  other: "其他",
};

const STATUS_TEXT: Record<FeedbackStatus, string> = {
  open: "未处理",
  reviewing: "处理中",
  resolved: "已解决",
  closed: "已关闭",
};

const STATUS_BADGE: Record<FeedbackStatus, string> = {
  open: "bg-danger/15 text-danger",
  reviewing: "bg-accent-yellow/15 text-accent-yellow",
  resolved: "bg-accent-green/15 text-accent-green",
  closed: "bg-surface-active text-ink-muted",
};

const TYPE_BADGE: Record<FeedbackType, string> = {
  bug: "bg-danger/15 text-danger",
  feature: "bg-accent-blue/15 text-accent-blue",
  other: "bg-surface-active text-ink-muted",
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AdminFeedbackClient() {
  const [tickets, setTickets] = useState<FeedbackTicket[]>([]);
  const [openCount, setOpenCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | "all">(
    "all"
  );
  const [typeFilter, setTypeFilter] = useState<FeedbackType | "all">("all");

  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [noteBusy, setNoteBusy] = useState<Record<string, boolean>>({});
  const [noteError, setNoteError] = useState<string | null>(null);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (typeFilter !== "all") params.set("type", typeFilter);
      const qs = params.toString();
      const res = await fetch(`/api/admin/feedback${qs ? `?${qs}` : ""}`);
      const data = await res.json();
      if (!res.ok) {
        setLoadError(data.error || "加载失败");
        return;
      }
      setTickets(data.tickets || []);
      setOpenCount(data.openCount || 0);
    } catch {
      setLoadError("加载失败，请检查网络");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter]);

  useEffect(() => {
    void fetchTickets();
  }, [fetchTickets]);

  const patchTicket = async (
    id: string,
    body: { status?: FeedbackStatus; adminNote?: string | null }
  ) => {
    try {
      const res = await fetch(`/api/admin/feedback/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setNoteError(data.message || data.error || "更新失败");
        return false;
      }
      setTickets((prev) =>
        prev.map((t) => (t.id === id ? data.ticket : t))
      );
      setNoteError(null);
      return true;
    } catch {
      setNoteError("更新失败，请检查网络");
      return false;
    }
  };

  const setStatus = async (t: FeedbackTicket, status: FeedbackStatus) => {
    const ok = await patchTicket(t.id, { status });
    if (ok) void fetchTickets(); // 刷新未处理数
  };

  const saveNote = async (t: FeedbackTicket) => {
    const draft = (noteDrafts[t.id] ?? "").trim();
    setNoteBusy((b) => ({ ...b, [t.id]: true }));
    const ok = await patchTicket(t.id, { adminNote: draft.length ? draft : null });
    if (ok) {
      setNoteDrafts((d) => ({ ...d, [t.id]: draft }));
    }
    setNoteBusy((b) => ({ ...b, [t.id]: false }));
  };

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
        <h1 className="text-sm font-semibold text-ink">用户反馈</h1>
        {openCount > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-danger/15 text-danger">
            {openCount} 条未处理
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin [scrollbar-gutter:stable] p-4">
        {/* 筛选 */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            {(["all", "open", "reviewing", "resolved", "closed"] as const).map(
              (s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-btn transition-colors ${
                    statusFilter === s
                      ? "bg-primary text-white"
                      : "text-ink-secondary bg-surface-hover hover:bg-surface-active"
                  }`}
                >
                  {s === "all" ? "全部" : STATUS_TEXT[s]}
                </button>
              )
            )}
          </div>
          <div className="flex items-center gap-1 ml-2">
            {(["all", "bug", "feature", "other"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-2.5 py-1 text-xs font-medium rounded-btn transition-colors ${
                  typeFilter === t
                    ? "bg-primary text-white"
                    : "text-ink-secondary bg-surface-hover hover:bg-surface-active"
                }`}
              >
                {t === "all" ? "全部类型" : TYPE_TEXT[t]}
              </button>
            ))}
          </div>
        </div>

        {noteError && (
          <p className="mt-2 text-[11px] text-danger">{noteError}</p>
        )}

        {loading && (
          <p className="text-sm text-ink-muted py-6 text-center">加载中…</p>
        )}
        {!loading && loadError && (
          <div className="text-sm text-danger py-6 text-center">
            {loadError}
            <button
              onClick={() => void fetchTickets()}
              className="ml-2 underline hover:text-ink"
            >
              重试
            </button>
          </div>
        )}
        {!loading && !loadError && tickets.length === 0 && (
          <p className="text-sm text-ink-muted py-6 text-center">暂无反馈</p>
        )}

        <ul className="mt-3 space-y-2 max-w-2xl">
          {tickets.map((t) => {
            const displayName = t.user.displayName || t.user.username;
            return (
              <li
                key={t.id}
                className="px-3.5 py-3 bg-toolbar-bg border border-border-light rounded-card"
              >
                <div className="flex items-center gap-2.5">
                  <UserAvatar
                    user={{
                      username: t.user.username,
                      displayName: t.user.displayName,
                      avatarColor: undefined,
                      avatarUrl: undefined,
                    }}
                    size="md"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-semibold text-ink truncate">
                        {displayName}
                      </span>
                      <span
                        className={`flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-full ${TYPE_BADGE[t.type]}`}
                      >
                        {TYPE_TEXT[t.type]}
                      </span>
                      <span
                        className={`flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-full ${STATUS_BADGE[t.status]}`}
                      >
                        {STATUS_TEXT[t.status]}
                      </span>
                    </div>
                    <p className="text-[11px] text-ink-muted truncate">
                      {t.user.email || `@${t.user.username}`} · 提交于{" "}
                      {formatDateTime(t.createdAt)}
                      {t.pageUrl ? ` · ${t.pageUrl}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {(["reviewing", "resolved", "closed"] as const).map(
                      (s) => (
                        <button
                          key={s}
                          onClick={() => void setStatus(t, s)}
                          disabled={t.status === s}
                          className={`px-2 py-1 text-[11px] font-medium rounded-btn transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                            t.status === s
                              ? "bg-primary text-white"
                              : "text-ink-secondary hover:bg-surface-hover"
                          }`}
                        >
                          {STATUS_TEXT[s]}
                        </button>
                      )
                    )}
                  </div>
                </div>

                <p className="mt-2 text-sm font-semibold text-ink">
                  {t.title}
                </p>
                <p className="mt-1 text-sm text-ink-secondary whitespace-pre-wrap break-words">
                  {t.content}
                </p>

                {t.userAgent && (
                  <p className="mt-2 text-[10px] text-ink-muted/70 break-all leading-relaxed">
                    UA：{t.userAgent}
                    {t.appVersion ? ` · 版本 ${t.appVersion}` : ""}
                  </p>
                )}

                <div className="mt-2 flex items-center gap-2">
                  <input
                    value={noteDrafts[t.id] ?? t.adminNote ?? ""}
                    onChange={(e) =>
                      setNoteDrafts((d) => ({ ...d, [t.id]: e.target.value }))
                    }
                    placeholder="管理员备注（可选）"
                    className="flex-1 min-w-0 px-2.5 py-1.5 text-xs text-ink bg-search-bg border border-border-soft rounded-input outline-none focus:border-surface-focus focus:ring-1 focus:ring-surface-focus transition-all placeholder:text-ink-muted/60"
                  />
                  <button
                    onClick={() => void saveNote(t)}
                    disabled={noteBusy[t.id]}
                    className="flex-shrink-0 px-2.5 py-1.5 text-xs font-medium text-ink-secondary rounded-btn hover:bg-surface-hover disabled:opacity-50 transition-colors"
                  >
                    {noteBusy[t.id] ? "保存中…" : "保存备注"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
