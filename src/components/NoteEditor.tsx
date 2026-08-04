"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Note, NoteColor, ChecklistItem, ChecklistGroup, Attachment } from "@/types";
import ColorPicker from "./ColorPicker";
import SaveStatus from "./SaveStatus";
import ChecklistEditor from "./ChecklistEditor";
import ImageAttachments from "./ImageAttachments";
import ImageUploadButton from "./ImageUploadButton";
import AutoGrowTextarea from "./AutoGrowTextarea";
import { normalizeChecklist, textToChecklist, checklistToText } from "@/lib/note-serializer";
import { isTauri, getAlwaysOnTop, toggleAlwaysOnTop } from "@/lib/tauri";

const DEBOUNCE_MS = 800;

interface Props {
  note: Note | null;
  onUpdate: (note: Note) => void;
  onDelete: (id: string) => void;
  onArchive?: (id: string) => void;
  onNewNote?: () => void;
  showBackButton?: boolean;
  onBack?: () => void;
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
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">(
    "saved"
  );
  const [windowAlwaysOnTop, setWindowAlwaysOnTop] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const currentNoteIdRef = useRef<string | null>(null);
  const pendingUpdatesRef = useRef<Record<string, unknown>>({});
  const lastFailedPayloadRef = useRef<Record<string, unknown> | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const prevNoteIdRef = useRef<string | null>(null);

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
        const res = await fetch(
          `/api/notes/${currentNoteIdRef.current}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updates),
          }
        );
        if (!res.ok) throw new Error("Save failed");
        const updated: Note = await res.json();
        onUpdate(updated);
        setSaveStatus("saved");
        lastFailedPayloadRef.current = null;
      } catch {
        setSaveStatus("error");
        lastFailedPayloadRef.current = updates;
      }
    },
    [onUpdate]
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

  // Reset local state when switching notes (flush pending first)
  useEffect(() => {
    if (!note) return;
    const noteIdChanged = note.id !== prevNoteIdRef.current;
    prevNoteIdRef.current = note.id;

    if (noteIdChanged) {
      flushPendingSave();
    }

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

    // Auto-focus title on new note
    if (noteIdChanged && titleRef.current) {
      titleRef.current.focus();
    }
  }, [note?.id]);

  // Cleanup on unmount: flush pending via keepalive fetch
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      const pending = { ...pendingUpdatesRef.current };
      if (Object.keys(pending).length > 0 && currentNoteIdRef.current) {
        fetch(`/api/notes/${currentNoteIdRef.current}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(pending),
          keepalive: true,
        }).catch(() => {});
      }
    };
  }, []);

  const handleTitleChange = (value: string) => {
    setTitle(value);
    debouncedSave({ title: value });
  };

  const handleContentChange = (value: string) => {
    setContent(value);
    debouncedSave({ content: value });
  };

  const handleChecklistChange = (items: ChecklistItem[], groups: ChecklistGroup[]) => {
    setChecklistItems(items);
    setChecklistGroups(groups);
    debouncedSave({ checklistItems: items, checklistGroups: groups, mode: "checklist" });
  };

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
    if (!confirm("确定删除此便签？删除后可在回收站恢复。")) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    pendingUpdatesRef.current = {};
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
    <div className="flex-1 flex flex-col h-full bg-panel-bg">
      {/* Editor toolbar */}
      <div className="flex items-center gap-1 px-2 py-2 border-b border-border-light bg-toolbar-bg min-h-[56px] sm:gap-1.5 sm:px-4 flex-wrap">
        {showBackButton && (
          <button
            onClick={onBack}
            className="flex items-center justify-center w-icon-btn h-icon-btn text-ink-muted hover:text-ink hover:bg-white/[0.08] rounded-btn md:hidden transition-colors"
            title="返回列表"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        {/* Mode switch */}
        <button
          onClick={handleModeSwitch}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-btn text-toolbar transition-colors ${
            mode === "checklist"
              ? "bg-white/10 text-ink"
              : "text-ink-muted hover:text-ink hover:bg-white/[0.08]"
          }`}
          title={mode === "checklist" ? "切换到普通便签" : "切换到待办清单"}
        >
          {mode === "checklist" ? (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="hidden sm:inline">便签</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              <span className="hidden sm:inline">待办</span>
            </>
          )}
        </button>

        <div className="w-px h-5 bg-border-light mx-1" />

        {/* Color picker inline */}
        <ColorPicker selected={color} onChange={handleColorChange} />

        <div className="flex-1" />

        <SaveStatus status={saveStatus} onRetry={handleRetry} />

        <ImageUploadButton
          noteId={currentNoteIdRef.current || ""}
          onUploaded={(uploaded) =>
            setAttachments((prev) => [...prev, ...uploaded])
          }
        />

        {isTauri() && (
          <button
            onClick={handleWindowPinToggle}
            className={`flex items-center justify-center w-icon-btn h-icon-btn rounded-btn transition-colors ${
              windowAlwaysOnTop
                ? "text-[#E3C24A] bg-white/10"
                : "text-ink-muted hover:text-ink hover:bg-white/[0.08]"
            }`}
            title={windowAlwaysOnTop ? "取消窗口置顶" : "窗口置顶"}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 3v3m6-3v3M5 6h14v2a2 2 0 01-2 2H7a2 2 0 01-2-2V6zM12 10v9m-3 2h6" />
            </svg>
          </button>
        )}

        <button
          onClick={handlePinToggle}
          className={`flex items-center justify-center w-icon-btn h-icon-btn rounded-btn transition-colors ${
            isPinned
              ? "text-[#E3C24A] bg-white/10"
              : "text-ink-muted hover:text-ink hover:bg-white/[0.08]"
          }`}
          title={isPinned ? "取消置顶" : "置顶"}
        >
          <svg className="w-5 h-5" fill={isPinned ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
        </button>
        <button
          onClick={handleArchive}
          className="flex items-center justify-center w-icon-btn h-icon-btn text-ink-muted hover:text-ink hover:bg-white/[0.08] rounded-btn transition-colors"
          title="归档"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
          </svg>
        </button>
        <button
          onClick={handleDelete}
          className="flex items-center justify-center w-icon-btn h-icon-btn text-ink-muted hover:text-danger hover:bg-white/[0.08] rounded-btn transition-colors"
          title="删除"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      {/* Editor body */}
      <div
        className="flex-1 overflow-y-auto scrollbar-thin"
        onKeyDown={handleKeyDown}
      >
        <div className="min-h-full flex flex-col">
          <div className="max-w-paper mx-auto w-full px-[clamp(12px,4vw,48px)] pt-5 pb-8 space-y-4 flex-1">
            <input
              ref={titleRef}
              type="text"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="无标题便签"
              className="w-full text-edit-title text-ink border-none outline-none bg-transparent placeholder:text-ink-muted/60"
            />

            {mode === "text" ? (
              <AutoGrowTextarea
                value={content}
                onChange={handleContentChange}
                placeholder="开始记录..."
                className="w-full border-none outline-none bg-transparent text-edit-body text-ink placeholder:text-ink-muted/55"
                minHeight={200}
              />
            ) : (
              <ChecklistEditor
                items={checklistItems}
                groups={checklistGroups}
                onChange={handleChecklistChange}
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
    </div>
  );
}
