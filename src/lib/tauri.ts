"use client";

import { invoke } from "@tauri-apps/api/core";

export function isTauri(): boolean {
  return (
    typeof window !== "undefined" && "__TAURI_INTERNALS__" in window
  );
}

export async function openFloatingNote(id: string): Promise<void> {
  await invoke("open_floating_note", { id });
}

export async function toggleAlwaysOnTop(): Promise<boolean> {
  return await invoke("toggle_always_on_top");
}

export async function getAlwaysOnTop(): Promise<boolean> {
  return await invoke("get_always_on_top");
}

/** M11.1：外部链接打开。桌面壳走 open_external（系统浏览器，不困在 WebView）；网页端新标签。 */
export async function openExternal(url: string): Promise<void> {
  if (isTauri()) {
    await invoke("open_external", { url });
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
