import type { Metadata } from "next";
import {
  DESKTOP_MAC_DOWNLOAD_URL,
  DESKTOP_RELEASES_URL,
  DESKTOP_WINDOWS_INSTALLER_URL,
} from "@/lib/downloads";

export const metadata: Metadata = {
  title: "PinNote 桌面版",
  description:
    "把重要便签固定在电脑桌面，随时记录待办、备忘和临时想法。网页端和桌面端使用同一账号，数据自动同步。",
};

const FEATURES = [
  {
    title: "桌面置顶",
    desc: "重要便签可以保持在桌面前方",
    icon: "M9 3v3m6-3v3M5 6h14v2a2 2 0 01-2 2H7a2 2 0 01-2-2V6zM12 10v9m-3 2h6",
  },
  {
    title: "同步数据",
    desc: "网页端和桌面端使用同一账号",
    icon: "M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4",
  },
  {
    title: "待办和备忘",
    desc: "支持普通便签和待办清单",
    icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
  },
  {
    title: "离线保护",
    desc: "网络不稳定时尽量保护未保存内容",
    icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
  },
];

const RECENT_UPDATES = [
  "支持邀请制注册和账号管理",
  "支持存储额度和头像设置",
  "支持多选删除和回收站",
  "支持用户反馈",
  "打开便签查看不会打乱排序",
];

function FeatureIcon({ d }: { d: string }) {
  return (
    <span className="flex items-center justify-center w-icon-btn h-icon-btn shrink-0 bg-surface-hover rounded-btn text-primary">
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d={d} />
      </svg>
    </span>
  );
}

function PlatformCard({
  title,
  subtitle,
  icon,
  href,
  buttonLabel,
  note,
}: {
  title: string;
  subtitle: string;
  icon: string;
  href: string;
  buttonLabel: string;
  note?: string;
}) {
  return (
    <div className="flex flex-col items-start gap-3 bg-toolbar-bg border border-border-light rounded-card p-4">
      <div className="flex items-center gap-3">
        <span className="flex items-center justify-center w-10 h-10 shrink-0 bg-surface-hover rounded-btn text-primary">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
          </svg>
        </span>
        <div>
          <p className="font-semibold leading-tight">{title}</p>
          <p className="mt-0.5 text-list-summary text-ink-muted">{subtitle}</p>
        </div>
      </div>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 w-full px-5 py-2.5 bg-selection-yellow text-white rounded-btn font-semibold hover:brightness-110 active:brightness-95 transition-all"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        {buttonLabel}
      </a>
      {note && <p className="text-list-meta text-ink-muted">{note}</p>}
    </div>
  );
}

export default function DownloadPage() {
  return (
    <div className="h-screen overflow-y-auto bg-page-bg text-ink scrollbar-thin">
      <div className="min-h-full max-w-paper mx-auto px-5 py-10 sm:py-14 flex flex-col">
        <header className="flex items-center gap-3">
          <img src="/icon.png" alt="PinNote" className="w-12 h-12 rounded-xl object-cover shadow-md shadow-black/10" />
          <div>
            <h1 className="text-login-title font-bold">PinNote 桌面版</h1>
            <p className="text-list-summary text-ink-muted">Windows / Mac</p>
          </div>
        </header>

        <p className="mt-6 text-edit-body text-ink-secondary leading-relaxed">
          把重要便签固定在电脑桌面，随时记录待办、备忘和临时想法。网页端和桌面端使用同一账号，数据自动同步。
        </p>

        <div className="mt-8 grid sm:grid-cols-2 gap-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="flex items-start gap-3 bg-toolbar-bg border border-border-light rounded-card p-4"
            >
              <FeatureIcon d={f.icon} />
              <div className="min-w-0">
                <p className="font-semibold leading-tight">{f.title}</p>
                <p className="mt-1 text-list-summary text-ink-muted">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 grid sm:grid-cols-2 gap-3">
          <PlatformCard
            title="Windows 版"
            subtitle="适用于 Windows 10/11"
            icon="M3 5h18v14H3z"
            href={DESKTOP_WINDOWS_INSTALLER_URL}
            buttonLabel="下载 Windows 版"
            note="安装后使用你的 PinNote 账号登录。"
          />
          <PlatformCard
            title="Mac 版"
            subtitle="适用于 macOS（Intel + Apple Silicon）"
            icon="M4 5h16a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1z"
            href={DESKTOP_MAC_DOWNLOAD_URL}
            buttonLabel="下载 Mac 版"
            note="内测包，未签名公证。首次打开如提示安全限制，请在系统设置 → 隐私与安全性中允许打开。"
          />
        </div>

        <a
          href={DESKTOP_RELEASES_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center justify-center gap-2 px-5 py-2.5 border border-border-light rounded-btn text-ink hover:bg-surface-hover transition-colors"
        >
          查看所有版本
        </a>

        <details className="mt-8 border border-border-light rounded-card bg-toolbar-bg">
          <summary className="cursor-pointer select-none px-4 py-3 text-list-title font-semibold text-ink-muted">
            近期更新
          </summary>
          <ul className="px-5 pb-4 space-y-1.5 text-list-summary text-ink-secondary">
            {RECENT_UPDATES.map((r) => (
              <li key={r}>· {r}</li>
            ))}
          </ul>
        </details>

        <p className="mt-auto pt-10 text-list-meta text-ink-muted text-center">PinNote</p>
      </div>
    </div>
  );
}
