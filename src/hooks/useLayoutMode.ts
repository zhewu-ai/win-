"use client";

import { useEffect, useState } from "react";

export type LayoutMode = "spacious" | "compact" | "single";

const SPACIOUS = 900;
const DUAL = 720;

export function useLayoutMode(): LayoutMode {
  const [mode, setMode] = useState<LayoutMode>("compact");

  useEffect(() => {
    const compute = () => {
      const w = window.innerWidth;
      setMode(w >= SPACIOUS ? "spacious" : w >= DUAL ? "compact" : "single");
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);

  return mode;
}
