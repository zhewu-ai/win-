"use client";

import { useEffect } from "react";

// 仅在 production 注册 Service Worker；dev 不注册避免缓存 HMR。
export default function SWRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    const onLoad = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        const warm = () => {
          if (reg.active) {
            reg.active.postMessage({ type: "CACHE_SHELL" });
          }
        };
        if (reg.active) {
          warm();
        } else {
          reg.addEventListener("updatefound", () => {
            const w = reg.installing;
            if (!w) return;
            w.addEventListener("statechange", () => {
              if (w.state === "activated") warm();
            });
          });
        }
      } catch (e) {
        console.error("Service Worker 注册失败:", e);
      }
    };

    if (document.readyState === "complete") {
      void onLoad();
    } else {
      window.addEventListener("load", onLoad, { once: true });
      return () => window.removeEventListener("load", onLoad);
    }
  }, []);

  return null;
}
