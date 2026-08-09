"use client";

import type { WorkProjectColor, WorkScheduleItem } from "@/types";
import { wpClass } from "./color";

interface Props {
  item: WorkScheduleItem;
  colorKey: WorkProjectColor;
  onClick: () => void;
  /** 紧凑模式：只显示标题，适合周视图列内。 */
  compact?: boolean;
}

// 排期条目小卡片：同一项目同色系；node 带圆点标记、range 细条感；done 划线。
export default function WorkScheduleChip({ item, colorKey, onClick, compact }: Props) {
  const done = item.status === "done";
  return (
    <button
      type="button"
      onClick={(ev) => {
        ev.stopPropagation();
        onClick();
      }}
      title={item.title}
      className={`flex w-full items-center gap-1 text-left text-xs leading-tight rounded px-1.5 py-1 ${wpClass(
        colorKey
      )} wp-chip transition-colors truncate ${done ? "line-through opacity-55" : ""}`}
    >
      <span
        className={`flex-shrink-0 ${
          item.type === "node" ? "w-1.5 h-1.5 rounded-full wp-dot" : "w-1 h-3 rounded-sm wp-dot"
        }`}
        aria-hidden="true"
      />
      <span className="flex-1 min-w-0 truncate">{item.title || "未命名排期"}</span>
      {item.note && (
        <svg className="w-3 h-3 flex-shrink-0 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )}
    </button>
  );
}
