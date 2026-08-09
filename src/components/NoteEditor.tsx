"use client";

import { useState, useEffect, useRef, useCallback, useLayoutEffect } from "react";
import type { Note, NoteColor, ChecklistItem, ChecklistGroup, Attachment } from "@/types";
import ColorPicker from "./ColorPicker";
import SaveStatus from "./SaveStatus";
import ChecklistEditor from "./ChecklistEditor";
import ImageAttachments from "./ImageAttachments";
import ImageUploadButton, { type ImageUploadHandle } from "./ImageUploadButton";
import AutoGrowTextarea from "./AutoGrowTextarea";
import LinkEditor from "./LinkEditor";
import InsertNoteLinkDialog from "./InsertNoteLinkDialog";
import ConfirmDialog from "./ConfirmDialog";
import { normalizeChecklist, textToChecklist, checklistToText } from "@/lib/note-serializer";
import { isTauri, getAlwaysOnTop, toggleAlwaysOnTop } from "@/lib/tauri";
import { saveNoteUpdate } from "@/lib/offline/persist";
import { clearDraft, getDraft } from "@/lib/offline/draft";
import { useDraftRecovery } from "@/hooks/useDraftRecovery";
import { serializeNoteText } from "@/lib/note-text-schema";
import { escapeLinkTitle } from "@/lib/link-parser";
import type { Editor } from "@tiptap/react";

const DEBOUNCE_MS = 800;

interface Props {
  note: Note | null;
  onUpdate: (note: Note) => void;
  onDelete: (id: string) => void;
  onArchive?: (id: string) => void;
  onNewNote?: () => void;
  showBackButton?: boolean;
  onBack?: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  /** 页面在刷新前调用它 flush 本机未保存内容并重试失败载荷；返回 false 表示不能安全刷新 */
  refreshReadyRef?: React.MutableRefObject<(() => Promise<boolean>) | null>;
  /** M11.1 点击内部链接时打开目标便签；返回 false 表示目标失效/无权限（链接变灰） */
  onOpenNote?: (noteId: string) => Promise<boolean> | boolean | void;
  /** M11.1 可插入链接的未归档便签列表（插入对话框搜索来源） */
  linkableNotes?: Note[];
  /** M11.1.1 内部链接跳转返回栈：编辑器顶部显示「← 来源标题」返回入口 */
  onGoBack?: () => void;
  backLabel?: string;
}

function formatEditorDate(dateStr?: string): string {
  const date = dateStr ? new Date(dateStr) : new Date();
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export default function NoteEditor({
  note,
  onUpdate,
  onDelete,
  onArchive,
  onNewNote,
  showBackButton,
  onBack,
  onRefresh,
  refreshing,
  refreshReadyRef,
  onOpenNote,
  linkableNotes,
  onGoBack,
  backLabel,
}: Props) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [color, setColor] = useState<NoteColor>("yellow");
  const [isPinned, setIsPinned] = useState(false);
  const [isArchived, setIsArchived] = useState(false);
  const [mode, setMode] = useState<"text" | "checklist">("text");
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [checklistGroups, setChecklistGroups] = useState<ChecklistGroup[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [saveStatus, setSaveStatus] = useState<
    "saved" | "saving" | "error" | "localError"
  >("saved");
  const [windowAlwaysOnTop, setWindowAlwaysOnTop] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [insertLinkOpen, setInsertLinkOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  // 工具栏按编辑区实际容器宽度分三档（≥560 舒展 / 380-779 紧凑 / <380 极简）
  // 迟滞：进入各档与退出各档阈值分开，退出 spacious 需 >780（桥接侧边栏自动收起时编辑区约跳到 720 的跳变，避免一次收窄中反复“收起→展开→再收起”）
  const [toolbarMode, setToolbarMode] = useState<"spacious" | "compact" | "minimal">("compact");
  const toolbarModeRef = useRef<"spacious" | "compact" | "minimal">("compact");
  const editorRootRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const currentNoteIdRef = useRef<string | null>(null);
  const pendingUpdatesRef = useRef<Record<string, unknown>>({});
  const lastFailedPayloadRef = useRef<Record<string, unknown> | null>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const contentEditorRef = useRef<Editor | null>(null);
  const prevNoteIdRef = useRef<string | null>(null);
  const prevUpdatedAtRef = useRef<string | undefined>(undefined);
  const moreRef = useRef<HTMLDivElement>(null);
  const imageUploadRef = useRef<ImageUploadHandle>(null);

  // 防丢保护：关闭/刷新前同步写 localStorage 草稿镜像；保存成功且服务器追上后清理
  const { restored, setRestored, confirmSaved, writeDraft } = useDraftRecovery({
    noteId: note?.id ?? null,
    getDraftState: () => {
      if (!currentNoteIdRef.current) return null;
      return {
        noteId: currentNoteIdRef.current,
        title,
        content,
        mode,
        color,
        isPinned,
        isArchived,
        checklistItems,
        checklistGroups,
        updatedAt: new Date().toISOString(),
      };
    },
  });

  // Close "more" menu on outside click
  useEffect(() => {
    if (!moreOpen) return;
    const handler = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [moreOpen]);

  // Create a stable empty checklist item for fallback
  function createEmptyItem(): ChecklistItem {
    const now = new Date().toISOString();
    return {
      id: generateId(),
      text: "",
      checked: false,
      sortOrder: Date.now(),
      createdAt: now,
      updatedAt: now,
    };
  }

  const doSave = useCallback(
    async (updates: Record<string, unknown>) => {
      if (!currentNoteIdRef.current) return;
      setSaveStatus("saving");
      try {
        // 在线 PATCH + 镜像；离线/断网自动写入本地缓存（pending），返回合并后的便签
        const updated = await saveNoteUpdate(
          currentNoteIdRef.current,
          updates
        );
        onUpdate(updated);
        setSaveStatus("saved");
        lastFailedPayloadRef.current = null;
        confirmSaved(currentNoteIdRef.current, updated.updatedAt);
      } catch {
        lastFailedPayloadRef.current = updates;
        // 服务器未保存成功：先落本地草稿镜像；本地也失败才提示“不要关闭窗口”
        if (!writeDraft()) {
          setSaveStatus("localError");
        } else {
          setSaveStatus("error");
        }
      }
    },
    [confirmSaved, onUpdate, writeDraft]
  );

  // Use ref to avoid stale closure in debounced callbacks
  const saveRef = useRef(doSave);
  saveRef.current = doSave;

  // Debounced save: merge pending updates, then send accumulated changes
  const debouncedSave = useCallback(
    (updates: Record<string, unknown>) => {
      Object.assign(pendingUpdatesRef.current, updates);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      setSaveStatus("saving");
      debounceRef.current = setTimeout(() => {
        const pending = { ...pendingUpdatesRef.current };
        pendingUpdatesRef.current = {};
        saveRef.current(pending);
      }, DEBOUNCE_MS);
    },
    []
  );

  // Immediate save: merge pending + flush immediately
  const immediateSave = useCallback(
    async (updates: Record<string, unknown>) => {
      Object.assign(pendingUpdatesRef.current, updates);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      const pending = { ...pendingUpdatesRef.current };
      pendingUpdatesRef.current = {};
      await saveRef.current(pending);
    },
    []
  );

  // Flush any pending save (fire-and-forget)
  const flushPendingSave = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = undefined;
    }
    const pending = { ...pendingUpdatesRef.current };
    pendingUpdatesRef.current = {};
    if (Object.keys(pending).length > 0 && currentNoteIdRef.current) {
      saveRef.current(pending);
    }
  }, []);

  // 刷新前置保护：flush debounce pending + 重试上次失败载荷；全部成功后返回 true。
  // 由 page 在刷新前调用，确保不会用服务器旧快照覆盖本机正在输入的内容。
  const flushAndEnsureSaved = useCallback(async (): Promise<boolean> => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = undefined;
    }
    const pending = { ...pendingUpdatesRef.current };
    pendingUpdatesRef.current = {};
    if (Object.keys(pending).length > 0 && currentNoteIdRef.current) {
      await saveRef.current(pending);
    }
    if (lastFailedPayloadRef.current) {
      const retry = { ...lastFailedPayloadRef.current };
      await saveRef.current(retry);
    }
    return !lastFailedPayloadRef.current;
  }, []);

  // 把刷新前置保护暴露给 page
  useEffect(() => {
    if (refreshReadyRef) refreshReadyRef.current = flushAndEnsureSaved;
    return () => {
      if (refreshReadyRef) refreshReadyRef.current = null;
    };
  }, [refreshReadyRef, flushAndEnsureSaved]);

  // Reset local state when switching notes (flush pending first)。
  // 同一条便签远端版本更新（updatedAt 变化）时，仅在本机无未保存内容时应用新版，
  // 否则保留本地编辑，避免服务器快照覆盖正在输入的内容。
  useEffect(() => {
    if (!note) return;
    const noteIdChanged = note.id !== prevNoteIdRef.current;
    const remoteVersionChanged =
      !noteIdChanged && note.updatedAt !== prevUpdatedAtRef.current;
    prevNoteIdRef.current = note.id;
    prevUpdatedAtRef.current = note.updatedAt;

    if (noteIdChanged) {
      flushPendingSave();
      // 切换便签关闭插入对话框，避免旧便签的态残留
      setInsertLinkOpen(false);
    }

    const localDirty =
      saveStatus !== "saved" ||
      Object.keys(pendingUpdatesRef.current).length > 0 ||
      lastFailedPayloadRef.current !== null ||
      restored;

    if (noteIdChanged || (remoteVersionChanged && !localDirty)) {
      currentNoteIdRef.current = note.id;
      setTitle(note.title);
      setContent(note.content);
      setColor(note.color as NoteColor);
      setIsPinned(note.isPinned);
      setIsArchived(note.isArchived);
      setMode(note.mode || "text");
      const rawItems =
        note.checklistItems && note.checklistItems.length > 0
          ? note.checklistItems
          : note.mode === "checklist"
            ? [{ ...createEmptyItem() }]
            : [];
      const normalized = normalizeChecklist(rawItems, note.checklistGroups || []);
      setChecklistItems(normalized.items);
      setChecklistGroups(normalized.groups);
      if (normalized.changed && note.mode === "checklist") {
        saveRef.current({
          checklistItems: normalized.items,
          checklistGroups: normalized.groups,
        });
      }
      setAttachments(note.attachments || []);
      setSaveStatus("saved");
      lastFailedPayloadRef.current = null;
      // 远端新版已应用：清掉可能残留的草稿镜像，避免下次打开时用旧内容覆盖
      if (remoteVersionChanged) clearDraft(note.id);
    } else {
      currentNoteIdRef.current = note.id;
    }

    // Auto-focus title on new note
    if (noteIdChanged && titleRef.current) {
      titleRef.current.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note?.id, note?.updatedAt]);

  // 防丢：打开便签时检查本地草稿镜像，比服务器内容新则恢复并提示
  useEffect(() => {
    if (!note) return;
    const d = getDraft();
    if (!d || d.noteId !== note.id) return;
    const same =
      d.title === note.title &&
      d.content === note.content &&
      JSON.stringify(d.checklistItems) ===
        JSON.stringify(note.checklistItems || []) &&
      JSON.stringify(d.checklistGroups) ===
        JSON.stringify(note.checklistGroups || []);
    if (same) {
      // 内容已同步，清理过期草稿
      clearDraft(note.id);
      return;
    }
    setTitle(d.title);
    setContent(d.content);
    setColor(d.color as NoteColor);
    setIsPinned(d.isPinned);
    setIsArchived(d.isArchived);
    setMode(d.mode);
    setChecklistItems(d.checklistItems);
    setChecklistGroups(d.checklistGroups);
    setRestored(d);
    // 立即回推服务器（在线 PATCH / 离线落 pending），保证下次打开即已同步
    saveRef.current({
      title: d.title,
      content: d.content,
      mode: d.mode,
      color: d.color,
      isPinned: d.isPinned,
      isArchived: d.isArchived,
      checklistItems: d.checklistItems,
      checklistGroups: d.checklistGroups,
    });
  }, [note?.id]);

  // 离开前 flush 未保存内容：在线走 keepalive PATCH，离线/断网走本地写（pending）
  const flushOnLeave = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = undefined;
    }
    const pending = { ...pendingUpdatesRef.current };
    pendingUpdatesRef.current = {};
    if (Object.keys(pending).length > 0 && currentNoteIdRef.current) {
      const id = currentNoteIdRef.current;
      if (navigator.onLine) {
        fetch(`/api/notes/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(pending),
          keepalive: true,
        }).catch(() => {});
      } else {
        void saveNoteUpdate(id, pending).catch(() => {});
      }
    }
  }, []);

  // Cleanup on unmount: flush pending via keepalive fetch (online) or local write (offline)
  useEffect(() => {
    return () => {
      flushOnLeave();
    };
  }, [flushOnLeave]);

  // 窗口关闭/刷新（unmount 不保证执行）：flush 未保存内容，草稿镜像由 useDraftRecovery 的 pagehide 兜底
  useEffect(() => {
    const onPageHide = () => {
      flushOnLeave();
    };
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [flushOnLeave]);

  // 用 ResizeObserver 跟踪编辑区真实宽度 → 工具栏三态；首帧前校正避免错位闪动
  useLayoutEffect(() => {
    if (!note) return;
    const el = editorRootRef.current;
    if (!el) return;
    // 方向性迟滞：同一档的进入/退出阈值分开，且退出 spacious 需 >780，桥接侧边栏
    // 自动收起时编辑区从 ~370 跳到 ~720 的跳变，避免一次连续收窄中出现
    // “compact → spacious → compact” 的来回切换。
    const update = (w: number) => {
      const cur = toolbarModeRef.current;
      let next = cur;
      if (cur === "spacious") {
        if (w < 380) next = "minimal";
        else if (w < 560) next = "compact";
      } else if (cur === "compact") {
        if (w >= 780) next = "spacious";
        else if (w < 380) next = "minimal";
      } else {
        // minimal
        if (w >= 440) next = w >= 780 ? "spacious" : "compact";
      }
      toolbarModeRef.current = next;
      setToolbarMode(next);
    };
    update(el.clientWidth);
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) update(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!note]);

  const handleTitleChange = (value: string) => {
    setTitle(value);
    debouncedSave({ title: value });
  };

  const handleContentChange = (value: string) => {
    setContent(value);
    debouncedSave({ content: value });
  };

  // M11.1 插入内部便签链接：经 LinkEditor 在当前选区（含失焦后保留的光标位）插入芯片节点；
  // 编辑器未就绪的罕见情况回退为追加纯文本语法。
  const insertNoteLink = useCallback(
    (target: Note) => {
      setInsertLinkOpen(false);
      const ed = contentEditorRef.current;
      if (!ed) {
        const snippet = `[[note:${target.id}|${escapeLinkTitle(target.title || "未命名便签")}]]`;
        const next = content
          ? `${content}${content.endsWith("\n") ? "" : "\n"}${snippet}`
          : snippet;
        setContent(next);
        immediateSave({ content: next });
        return;
      }
      ed.chain()
        .focus()
        .insertContentAt(ed.state.selection, {
          type: "noteLink",
          attrs: { id: target.id, title: target.title || "未命名便签" },
        })
        .run();
      immediateSave({ content: serializeNoteText(ed.state.doc) });
    },
    [content, immediateSave]
  );

  // 稳定引用：ChecklistEditor 的 useCallback 依赖它，不稳定会让行级 memo 失效
  const handleChecklistChange = useCallback(
    (items: ChecklistItem[], groups: ChecklistGroup[]) => {
      setChecklistItems(items);
      setChecklistGroups(groups);
      debouncedSave({
        checklistItems: items,
        checklistGroups: groups,
        mode: "checklist",
      });
    },
    [debouncedSave]
  );

  const handleColorChange = async (newColor: NoteColor) => {
    setColor(newColor);
    await immediateSave({ color: newColor });
  };

  // Window always-on-top state (desktop shell only)
  useEffect(() => {
    if (!isTauri()) return;
    getAlwaysOnTop()
      .then(setWindowAlwaysOnTop)
      .catch((e) => console.error("get_always_on_top failed:", e));
  }, []);

  const handleWindowPinToggle = async () => {
    if (!isTauri()) return;
    try {
      setWindowAlwaysOnTop(await toggleAlwaysOnTop());
    } catch (e) {
      console.error("toggle_always_on_top failed:", e);
      alert(`窗口置顶操作失败：${String(e)}`);
    }
  };

  const handlePinToggle = async () => {
    const newPinned = !isPinned;
    setIsPinned(newPinned);
    await immediateSave({ isPinned: newPinned });
  };

  const handleArchive = async () => {
    await immediateSave({ isArchived: true });
    onArchive?.(currentNoteIdRef.current!);
  };

  const handleDelete = () => {
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = () => {
    setDeleteConfirmOpen(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    pendingUpdatesRef.current = {};
    if (currentNoteIdRef.current) clearDraft(currentNoteIdRef.current);
    onDelete(currentNoteIdRef.current!);
  };

  const handleRetry = async () => {
    if (!lastFailedPayloadRef.current) return;
    await immediateSave({ ...lastFailedPayloadRef.current });
  };

  // Mode switch: text <-> checklist
  const handleModeSwitch = async () => {
    if (mode === "text") {
      const { items, groups } = textToChecklist(content);
      setMode("checklist");
      setChecklistItems(items);
      setChecklistGroups(groups);
      await immediateSave({
        mode: "checklist",
        checklistItems: items,
        checklistGroups: groups,
      });
    } else {
      const newContent = checklistToText(checklistItems, checklistGroups);
      setMode("text");
      setContent(newContent);
      await immediateSave({ mode: "text", content: newContent });
    }
  };

  // Cmd/Ctrl + Enter: create new note
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      // Flush pending saves before creating new note
      flushPendingSave();
      // Small delay to let the flush complete
      setTimeout(() => onNewNote?.(), 50);
    }
  };

  if (!note) {
    return (
      <div className="flex-1 flex items-center justify-center text-ink-muted text-sm bg-panel-bg">
        <div className="text-center">
          <svg className="w-8 h-8 text-ink-muted/30 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <p>选择一条便签开始编辑</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={editorRootRef} className="flex-1 flex flex-col h-full bg-panel-bg">
      {/* 图片上传入口在更多菜单：隐藏按钮常驻 DOM，由更多菜单项经 ref 触发。 */}
      <ImageUploadButton
        ref={imageUploadRef}
        noteId={currentNoteIdRef.current || ""}
        onUploaded={(uploaded) => setAttachments((prev) => [...prev, ...uploaded])}
        hidden
      />
      {/* Editor toolbar - always single line; low-freq ops live in "more" menu.
          固定 padding/gap，不用 sm: 媒体断点，避免 640px 附近内容整体横移一跳。 */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border-light bg-toolbar-bg min-h-[56px]">
        {showBackButton && (
          <button
            onClick={onBack}
            className="flex items-center justify-center w-icon-btn h-icon-btn text-ink-muted hover:text-ink hover:bg-surface-hover rounded-btn transition-colors"
            title="返回列表"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        {/* Mode switch：只保留图标，模式用 tooltip 表达，避免收窄时文字消失/出现造成跳变 */}
        <button
          onClick={handleModeSwitch}
          className={`flex items-center justify-center w-icon-btn h-icon-btn rounded-btn transition-colors ${
            mode === "checklist"
              ? "bg-surface-strong text-ink"
              : "text-ink-muted hover:text-ink hover:bg-surface-hover"
          }`}
          title={mode === "checklist" ? "切换到普通便签" : "切换到待办清单"}
        >
          {mode === "checklist" ? (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          )}
        </button>

        {toolbarMode !== "minimal" && (
          <div className="w-px h-5 bg-border-light mx-1" />
        )}

        {/* Color picker - spacious 显示色球 / compact 显示颜色按钮 / minimal 收进更多菜单 */}
        <ColorPicker selected={color} onChange={handleColorChange} mode={toolbarMode} />

        <div className="flex-1" />

        {/* 保存状态：常态（已保存+无待同步）返回 null 不占位；仅过程/异常态显示。
            放在刷新按钮左侧，状态出现时不影响右侧按钮组（minimal 时省略）。 */}
        {toolbarMode !== "minimal" && (
          <SaveStatus
            status={saveStatus}
            onRetry={handleRetry}
            showText={toolbarMode === "spacious"}
            syncStatus={note.syncStatus}
          />
        )}

        {/* 手动刷新：拉取服务器最新列表；刷新中禁用并旋转，避免重复请求 */}
        <button
          onClick={() => onRefresh?.()}
          disabled={refreshing}
          className="flex items-center justify-center w-icon-btn h-icon-btn flex-shrink-0 text-ink-muted hover:text-ink hover:bg-surface-hover rounded-btn transition-colors disabled:opacity-50 disabled:pointer-events-none"
          title="刷新便签"
          aria-label="刷新便签"
        >
          <svg
            className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>

        {/* 置顶便签：从更多菜单提升到主工具栏（原图片按钮位置） */}
        <button
          onClick={handlePinToggle}
          className={`flex items-center justify-center w-icon-btn h-icon-btn rounded-btn transition-colors ${
            isPinned
              ? "text-primary bg-surface-strong"
              : "text-ink-muted hover:text-ink hover:bg-surface-hover"
          }`}
          title={isPinned ? "取消置顶" : "置顶便签"}
        >
          <svg
            className="w-5 h-5"
            fill={isPinned ? "currentColor" : "none"}
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
        </button>

        {isTauri() && (
          <button
            onClick={handleWindowPinToggle}
            className={`flex items-center justify-center w-icon-btn h-icon-btn rounded-btn transition-colors ${
              windowAlwaysOnTop
                ? "text-primary bg-surface-strong"
                : "text-ink-muted hover:text-ink hover:bg-surface-hover"
            }`}
            title={windowAlwaysOnTop ? "取消窗口置顶" : "窗口置顶"}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 3v3m6-3v3M5 6h14v2a2 2 0 01-2 2H7a2 2 0 01-2-2V6zM12 10v9m-3 2h6" />
            </svg>
          </button>
        )}

        {/* More menu: pin / archive / delete / (color stays inline) */}
        <div className="relative flex-shrink-0" ref={moreRef}>
          <button
            onClick={() => setMoreOpen((o) => !o)}
            className="flex items-center justify-center w-icon-btn h-icon-btn text-ink-muted hover:text-ink hover:bg-surface-hover rounded-btn transition-colors"
            title="更多操作"
            aria-expanded={moreOpen}
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="5" r="1.7" />
              <circle cx="12" cy="12" r="1.7" />
              <circle cx="12" cy="19" r="1.7" />
            </svg>
          </button>
          {moreOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-44 py-1 bg-toolbar-bg border border-border-light rounded-card shadow-xl z-20 menu-pop">
              {toolbarMode === "minimal" && (
                <>
                  <div className="flex items-center gap-2 px-3.5 pt-2 pb-2.5">
                    {(
                      [
                        { value: "yellow", bg: "bg-accent-yellow" },
                        { value: "blue", bg: "bg-accent-blue" },
                        { value: "green", bg: "bg-accent-green" },
                        { value: "pink", bg: "bg-accent-pink" },
                        { value: "gray", bg: "bg-accent-gray" },
                      ] as const
                    ).map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => {
                          setMoreOpen(false);
                          handleColorChange(c.value);
                        }}
                        className={`w-5 h-5 ${c.bg} rounded-full transition-transform ${
                          color === c.value
                            ? "ring-2 ring-ring-selected ring-offset-2 ring-offset-toolbar-bg scale-110"
                            : "hover:scale-110"
                        }`}
                        title={c.value}
                        aria-label={c.value}
                      />
                    ))}
                  </div>
                  <div className="my-1 h-px bg-border-light/60" />
                </>
              )}
              {mode === "text" && (
                <>
                  <button
                    onClick={() => {
                      setMoreOpen(false);
                      setInsertLinkOpen(true);
                    }}
                    className="flex items-center gap-2 w-full px-3.5 py-2.5 text-sm text-ink hover:bg-surface-hover transition-colors"
                  >
                    <svg className="w-4 h-4 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                    </svg>
                    插入便签链接
                  </button>
                  <div className="my-1 h-px bg-border-light/60" />
                </>
              )}
              <button
                onClick={() => {
                  setMoreOpen(false);
                  imageUploadRef.current?.open();
                }}
                className="flex items-center gap-2 w-full px-3.5 py-2.5 text-sm text-ink hover:bg-surface-hover transition-colors"
              >
                <svg className="w-4 h-4 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                添加图片
              </button>
              <button
                onClick={() => {
                  setMoreOpen(false);
                  handleArchive();
                }}
                className="flex items-center gap-2 w-full px-3.5 py-2.5 text-sm text-ink hover:bg-surface-hover transition-colors"
              >
                <svg className="w-4 h-4 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
                归档
              </button>
              <div className="my-1 h-px bg-border-light/60" />
              <button
                onClick={() => {
                  setMoreOpen(false);
                  handleDelete();
                }}
                className="flex items-center gap-2 w-full px-3.5 py-2.5 text-sm text-danger hover:bg-surface-hover transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                删除
              </button>
            </div>
          )}
        </div>
      </div>

      {/* M11.1.1 内部链接跳转返回入口：点击「← 来源标题」回到来源便签 */}
      {onGoBack && backLabel && (
        <div className="flex items-center min-w-0 px-3 py-1.5 border-b border-border-light bg-surface-hover/40">
          <button
            onClick={onGoBack}
            className="flex items-center gap-1 min-w-0 text-xs text-primary hover:underline"
          >
            <svg
              className="w-3.5 h-3.5 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            <span className="truncate">{backLabel}</span>
          </button>
        </div>
      )}

      {/* Editor body */}
      {restored && (
        <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 border-b border-primary/20 text-sm text-primary">
          <span>发现未同步内容，已从本地恢复</span>
          <button
            onClick={() => setRestored(null)}
            className="ml-auto flex items-center justify-center w-5 h-5 rounded-btn hover:bg-primary/15 text-primary"
            title="关闭提示"
            aria-label="关闭提示"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
      <div
        className="flex-1 overflow-y-auto scrollbar-thin [scrollbar-gutter:stable]"
        onKeyDown={handleKeyDown}
      >
        <div className="min-h-full flex flex-col">
          <div className="max-w-paper mx-auto w-full px-[clamp(12px,4vw,48px)] pt-5 pb-8 space-y-4 flex-1">
            <AutoGrowTextarea
              value={title}
              onChange={handleTitleChange}
              placeholder="无标题便签"
              className="w-full text-edit-title text-ink border-none outline-none bg-transparent placeholder:text-ink-muted/60 resize-none"
              innerRef={titleRef}
              maxHeight={92}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !(e.metaKey || e.ctrlKey || e.shiftKey)) {
                  e.preventDefault();
                  e.currentTarget.blur();
                }
              }}
            />

            {mode === "text" ? (
              <LinkEditor
                value={content}
                onChange={handleContentChange}
                linkableNotes={linkableNotes || []}
                onOpenNote={onOpenNote}
                placeholder="开始记录..."
                resetKey={note.id}
                className="w-full text-edit-body text-ink"
                contentClassName="min-h-[200px]"
                editorRef={(ed) => {
                  contentEditorRef.current = ed;
                }}
              />
            ) : (
              <ChecklistEditor
                items={checklistItems}
                groups={checklistGroups}
                onChange={handleChecklistChange}
                linkableNotes={linkableNotes}
                onOpenNote={onOpenNote}
              />
            )}

            {/* Image attachments */}
            <ImageAttachments
              noteId={currentNoteIdRef.current || ""}
              attachments={attachments}
              onAttachmentsChange={setAttachments}
            />
          </div>

          {/* Bottom metadata: pinned to editor bottom when content is short,
              otherwise follows content and is visible after scrolling */}
          <div className="max-w-paper mx-auto w-full px-[clamp(12px,4vw,48px)] pt-2 pb-4 text-center text-xs text-ink-muted/45 select-none">
            最后编辑于 {formatEditorDate(note.updatedAt)}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={deleteConfirmOpen}
        title="删除便签"
        message="确定删除此便签？删除后可在回收站恢复。"
        confirmLabel="删除"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirmOpen(false)}
      />

      <InsertNoteLinkDialog
        open={insertLinkOpen}
        notes={linkableNotes || []}
        onSelect={insertNoteLink}
        onClose={() => setInsertLinkOpen(false)}
      />
    </div>
  );
}
