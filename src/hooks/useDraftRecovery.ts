"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { clearDraft, getDraft, saveDraft, type NoteDraft } from "@/lib/offline/draft";

interface Options {
  noteId: string | null;
  /** 组装当前便签的草稿镜像（读最新渲染状态）。 */
  getDraftState: () => NoteDraft | null;
}

/**
 * 防丢保护 hook：
 * - 关闭/刷新/离开页面前把未同步内容同步写入 localStorage 草稿镜像；
 * - 若草稿写入失败，用 beforeunload 拦截关闭；
 * - 保存成功且服务器已追上草稿时清理草稿。
 * 恢复草稿由编辑器在打开便签时调用 checkDraft 决定。
 */
export function useDraftRecovery({ noteId, getDraftState }: Options) {
  const getStateRef = useRef(getDraftState);
  getStateRef.current = getDraftState;

  const [restored, setRestored] = useState<NoteDraft | null>(null);

  // 始终写当前状态；写入失败时关闭保护介入
  const writeDraft = useCallback((): boolean => {
    const d = getStateRef.current();
    if (!d) return true;
    return saveDraft(d);
  }, []);

  // 服务器确认保存成功后清理草稿；若草稿比本次已保存内容还新（并发输入），保留并等待下次保存
  const confirmSaved = useCallback((id: string, serverUpdatedAt?: string) => {
    const d = getDraft();
    if (!d || d.noteId !== id) return;
    if (!serverUpdatedAt || d.updatedAt <= serverUpdatedAt) clearDraft(id);
  }, []);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      const ok = writeDraft();
      if (!ok) {
        e.preventDefault();
        e.returnValue =
          "当前内容还没有保存完成，关闭可能导致丢失。请稍等或重试保存。";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [writeDraft]);

  useEffect(() => {
    const onPageHide = () => {
      writeDraft();
    };
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [writeDraft]);

  return { restored, setRestored, confirmSaved, writeDraft };
}
