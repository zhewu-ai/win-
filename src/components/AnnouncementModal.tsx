"use client";

import { useEffect, useState } from "react";

interface LatestAnnouncement {
  id: string;
  title: string;
  content: string;
  version: string | null;
  publishedAt: string;
}

export default function AnnouncementModal() {
  const [announcement, setAnnouncement] = useState<LatestAnnouncement | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;
    fetch("/api/announcements/latest")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data?.announcement && !data.hasRead) {
          setAnnouncement(data.announcement);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const dismiss = () => {
    const id = announcement?.id;
    setAnnouncement(null);
    if (!id) return;
    // 记录已读，之后不再弹同一条公告；失败不影响关闭
    fetch(`/api/announcements/${id}/read`, { method: "POST" }).catch(() => {});
  };

  if (!announcement) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="presentation"
    >
      <div
        className="w-full max-w-[340px] rounded-modal bg-toolbar-bg border border-border-light shadow-2xl p-5"
        role="dialog"
        aria-modal="true"
        aria-label="更新公告"
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-bold text-ink break-words">
            {announcement.title}
          </h3>
          <button
            onClick={dismiss}
            className="flex-shrink-0 p-1 text-ink-muted hover:text-ink hover:bg-surface-hover rounded-btn transition-colors"
            title="关闭"
            aria-label="关闭"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {announcement.version && (
          <p className="mt-0.5 text-[11px] text-ink-muted">
            版本 {announcement.version}
          </p>
        )}
        <div className="mt-3 max-h-[50vh] overflow-y-auto scrollbar-thin">
          <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap break-words">
            {announcement.content}
          </p>
        </div>
        <div className="mt-5 flex justify-end">
          <button
            onClick={dismiss}
            className="px-3.5 py-1.5 rounded-btn text-sm font-semibold text-white bg-primary hover:brightness-110 transition-colors"
          >
            知道了
          </button>
        </div>
      </div>
    </div>
  );
}
