"use client";

import { useEffect, useState } from "react";

const SEEN_KEY = "seenReleaseNote_M10_8";

const ITEMS = [
  "账号菜单支持修改密码",
  "左侧便签列表支持多选删除到回收站",
  "可以上传自定义头像",
  "打开便签查看不会再改变排序，只有真正编辑后才更新时间",
];

export default function ReleaseNoteModal() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(SEEN_KEY) === "true") return;
    } catch {
      // localStorage 不可用时本次会话照常展示
    }
    setShow(true);
  }, []);

  const dismiss = () => {
    try {
      window.localStorage.setItem(SEEN_KEY, "true");
    } catch {
      // 写入失败不影响关闭
    }
    setShow(false);
  };

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="presentation"
    >
      <div
        className="w-full max-w-[340px] rounded-modal bg-toolbar-bg border border-border-light shadow-2xl p-5"
        role="dialog"
        aria-modal="true"
        aria-label="更新说明"
      >
        <h3 className="text-base font-bold text-ink">本次更新</h3>
        <ul className="mt-3 space-y-1.5">
          {ITEMS.map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm text-ink">
              <svg
                className="w-4 h-4 mt-0.5 text-primary flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-ink-muted">
          删除的便签仍可在回收站恢复。
        </p>
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
