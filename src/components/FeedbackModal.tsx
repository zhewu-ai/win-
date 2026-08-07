"use client";

import { useState, useEffect } from "react";
import type { FeedbackType } from "@/types";

interface Props {
  open: boolean;
  onClose: () => void;
}

const MAX_TITLE = 80;
const MAX_CONTENT = 2000;

const TYPE_OPTIONS: { value: FeedbackType; label: string }[] = [
  { value: "bug", label: "问题" },
  { value: "feature", label: "建议" },
  { value: "other", label: "其他" },
];

export default function FeedbackModal({ open, onClose }: Props) {
  const [type, setType] = useState<FeedbackType>("bug");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showEnv, setShowEnv] = useState(false);

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
    setType("bug");
    setTitle("");
    setContent("");
    setError("");
    setSuccess(false);
    setSaving(false);
    setShowEnv(false);
  }, [open]);

  if (!open) return null;

  const submit = async () => {
    const t = title.trim();
    const c = content.trim();
    if (t.length === 0) {
      setError("请输入标题");
      return;
    }
    if (t.length > MAX_TITLE) {
      setError(`标题不能超过 ${MAX_TITLE} 字`);
      return;
    }
    if (c.length === 0) {
      setError("请填写详细描述");
      return;
    }
    if (c.length > MAX_CONTENT) {
      setError(`描述不能超过 ${MAX_CONTENT} 字`);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          title: t,
          content: c,
          pageUrl: window.location.pathname,
          appVersion: undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(
          data.error === "RATE_LIMITED"
            ? "提交太频繁，请 1 分钟后再试"
            : data.message || data.error || "提交失败"
        );
        return;
      }
      setSuccess(true);
    } catch {
      setError("提交失败，请检查网络");
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
        aria-label="反馈问题"
      >
        <h3 className="text-base font-bold text-ink">反馈问题</h3>

        {success ? (
          <>
            <p className="mt-3 text-sm font-medium text-accent-green">
              反馈已提交，感谢你帮助改进 PinNote。
            </p>
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
              <span className="text-[11px] text-ink-muted">类型</span>
              <div className="mt-1 flex gap-1.5 flex-wrap">
                {TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setType(opt.value)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-btn transition-colors ${
                      type === opt.value
                        ? "bg-primary text-white"
                        : "text-ink-secondary bg-surface-hover hover:bg-surface-active"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </label>
            <label className="block">
              <span className="text-[11px] text-ink-muted">标题</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="一句话描述问题"
                className="mt-1 w-full px-2.5 py-1.5 text-sm text-ink bg-search-bg border border-border-soft rounded-input outline-none focus:border-surface-focus focus:ring-1 focus:ring-surface-focus transition-all placeholder:text-ink-muted/60"
              />
            </label>
            <label className="block">
              <span className="text-[11px] text-ink-muted">详细描述</span>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="请描述你遇到的问题或建议…"
                rows={4}
                className="mt-1 w-full px-2.5 py-1.5 text-sm text-ink bg-search-bg border border-border-soft rounded-input outline-none focus:border-surface-focus focus:ring-1 focus:ring-surface-focus transition-all placeholder:text-ink-muted/60 resize-none"
              />
              <span className="mt-0.5 block text-right text-[10px] text-ink-muted/60">
                {content.length}/{MAX_CONTENT}
              </span>
            </label>
            <div>
              <button
                type="button"
                onClick={() => setShowEnv((s) => !s)}
                className="text-[11px] font-medium text-ink-muted hover:text-ink underline"
              >
                {showEnv ? "收起" : "展开"}环境信息
              </button>
              {showEnv && (
                <p className="mt-1 text-[10px] text-ink-muted break-all leading-relaxed">
                  页面 {window.location.pathname}
                  <br />
                  浏览器 UA 会在提交时自动附带
                </p>
              )}
            </div>
            {error && <p className="text-xs text-danger">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => void submit()}
                disabled={saving}
                className="flex-1 py-1.5 text-sm font-medium text-white bg-primary rounded-btn hover:brightness-110 active:brightness-95 disabled:opacity-50 transition-all"
              >
                {saving ? "提交中..." : "提交反馈"}
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
