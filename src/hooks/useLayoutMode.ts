"use client";

import { useEffect, useState } from "react";

export type LayoutMode = "dual" | "single";

const SINGLE = 720;

export function useLayoutMode(): LayoutMode {
  const [mode, setMode] = useState<LayoutMode>("dual");

  useEffect(() => {
    const compute = () => {
      setMode(window.innerWidth < SINGLE ? "single" : "dual");
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);

  return mode;
}
