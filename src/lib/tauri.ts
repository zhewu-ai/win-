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
