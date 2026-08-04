"use client";

import { useState, useRef, useEffect } from "react";

interface Props {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onCreateNote: () => void;
  showBack?: boolean;
  onBack?: () => void;
  showEditor?: boolean;
}

export default function TopBar({
  searchQuery,
  onSearchChange,
  onCreateNote,
  showBack,
  onBack,
  showEditor,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const bottomMenuRef = useRef<HTMLDivElement>(null);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      const inTop = menuRef.current?.contains(e.target as Node);
      const inBottom = bottomMenuRef.current?.contains(e.target as Node);
      if (!inTop && !inBottom) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const newNoteButton = (
    <button
      onClick={onCreateNote}
      className="flex items-center justify-center w-icon-btn h-icon-btn flex-shrink-0 text-ink-muted hover:text-ink bg-white/[0.07] hover:bg-white/[0.12] rounded-btn transition-colors whitespace-nowrap"
      title="新建"
    >
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 20h9" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
      </svg>
    </button>
  );

  const accountEntry = (
    nodeRef: React.RefObject<HTMLDivElement>,
    dropdownPos: string
  ) => (
    <div className="relative flex-shrink-0" ref={nodeRef}>
      <button
        onClick={() => setMenuOpen((o) => !o)}
        className="flex items-center gap-1.5 pl-1 pr-1.5 py-1 text-ink-muted hover:text-ink hover:bg-white/[0.08] rounded-btn transition-colors"
        title="账户菜单"
        aria-expanded={menuOpen}
      >
        <span className="w-7 h-7 rounded-full bg-white/10 text-ink-secondary text-sm font-bold flex items-center justify-center">
          我
        </span>
        <span className="hidden sm:inline text-sm font-medium">个人便签</span>
        <svg className="hidden sm:block w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {menuOpen && (
        <div className={`absolute right-0 w-44 py-1 bg-toolbar-bg border border-border-light rounded-card shadow-xl z-20 ${dropdownPos}`}>
          <a
            href="/archive"
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-2 px-3.5 py-2.5 text-sm text-ink hover:bg-white/[0.06] transition-colors"
          >
            <svg className="w-4 h-4 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
            归档
          </a>
          <a
            href="/trash"
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-2 px-3.5 py-2.5 text-sm text-ink hover:bg-white/[0.06] transition-colors"
          >
            <svg className="w-4 h-4 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            回收站
          </a>
          <div className="my-1 h-px bg-border-light/60" />
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3.5 py-2.5 text-sm text-danger hover:bg-white/[0.06] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            退出登录
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className={`flex items-center gap-2 px-4 py-2 border-b border-border-light bg-toolbar-bg z-10 min-h-[56px] ${showEditor ? "max-[420px]:hidden" : ""}`}>
      {showBack && (
        <button
          onClick={onBack}
          className="flex items-center justify-center w-icon-btn h-icon-btn text-ink-muted hover:text-ink hover:bg-white/[0.08] rounded-btn md:hidden transition-colors"
          title="返回列表"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {!showEditor && (
        <div className="flex-1 relative min-w-0">
          <svg
            className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="搜索便签..."
            className="w-full pl-9 pr-8 py-1.5 text-sm text-ink bg-search-bg rounded-input border border-white/5 outline-none focus:bg-white/10 focus:border-white/10 focus:ring-1 focus:ring-white/10 transition-all placeholder:text-ink-muted"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-ink-muted hover:text-ink rounded transition-colors"
              title="清空搜索"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      )}
      {showEditor && <div className="flex-1" />}

      {/* Top-bar entries - hidden on narrow windows to free the header */}
      <div className="flex items-center gap-2 max-[420px]:hidden">
        {newNoteButton}
        {accountEntry(menuRef, "top-full mt-1.5")}
      </div>

      {/* Narrow-window fallback: bottom-left mini toolbar keeps 新建/账户 reachable */}
      <div className="fixed bottom-3 left-3 z-40 flex items-center gap-2 min-[421px]:hidden">
        {newNoteButton}
        {accountEntry(bottomMenuRef, "bottom-full mb-1.5")}
      </div>
    </div>
  );
}
