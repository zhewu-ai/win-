"use client";

import { useEffect, useState } from "react";

/** 进入单栏模式的宽度阈值（低于它从双栏切单栏）。 */
const ENTER_NARROW = 520;
/** 退出单栏模式的宽度阈值（高于它从单栏切回双栏）。 */
const EXIT_NARROW = 580;

/**
 * 判断窗口是否处于「极窄单栏」模式。
 *
 * 用双阈值迟滞避免在临界宽度附近拖动窗口时布局反复横跳：
 * 进入单栏在 520px 以下，退出在 580px 以上，两者之间保持当前状态。
 */
export function useNarrowMode(): boolean {
  const [isNarrow, setIsNarrow] = useState(false);

  useEffect(() => {
    const compute = () => {
      const w = window.innerWidth;
      setIsNarrow((prev) => {
        if (prev && w > EXIT_NARROW) return false;
        if (!prev && w < ENTER_NARROW) return true;
        return prev;
      });
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);

  return isNarrow;
}
