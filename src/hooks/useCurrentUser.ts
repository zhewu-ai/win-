"use client";

import { useEffect, useState } from "react";
import type { User } from "@/types";

// 客户端获取当前用户（含 role），用于管理员灰度的入口/今日条判断。
export function useCurrentUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        if (d?.user) setUser(d.user);
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return { user, loaded };
}
