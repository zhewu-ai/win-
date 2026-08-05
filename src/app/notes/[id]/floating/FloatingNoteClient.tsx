"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import type { Note, NoteColor, ChecklistItem, ChecklistGroup, Attachment } from "@/types";
import ColorPicker from "@/components/ColorPicker";
import SaveStatus from "@/components/SaveStatus";
import ChecklistEditor from "@/components/ChecklistEditor";
import ImageAttachments from "@/components/ImageAttachments";
import ImageUploadButton from "@/components/ImageUploadButton";
import AutoGrowTextarea from "@/components/AutoGrowTextarea";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useRouter } from "next/navigation";
import { normalizeChecklist, textToChecklist, checklistToText } from "@/lib/note-serializer";
import {
  isTauri,
  getAlwaysOnTop,
  toggleAlwaysOnTop,
} from "@/lib/tauri";

const DEBOUNCE_MS = 800;

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

interface Props {
  initialNote: Note;
  noteId: string;
}

export default function FloatingNoteClient({ initialNote, noteId }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initialNote.title);
  const [content, setContent] = useState(initialNote.content);
  const [color, setColor] = useState<NoteColor>(initialNote.color as NoteColor);
  const [isPinned, setIsPinned] = useState(initialNote.isPinned);
  const [mode, setMode] = useState<"text" | "checklist">(initialNote.mode || "text");
  const initialChecklist = useMemo(() => {
    const raw =
      initialNote.checklistItems && initialNote.checklistItems.length > 0
        ? initialNote.checklistItems
        : initialNote.mode === "checklist"
          ? [
              {
                id: generateId(),
                text: "",
                checked: false,
                sortOrder: Date.now(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            ]
          : [];
    return normalizeChecklist(raw, initialNote.checklistGroups || []);
  }, [initialNote]);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>(
    initialChecklist.items
  );
  const [checklistGroups, setChecklistGroups] = useState<ChecklistGroup[]>(
    initialChecklist.groups
  );
  const [attachments, setAttachments] = useState<Attachment[]>(
    initialNote.attachments || []
  );
  const [alwaysOnTop, setAlwaysOnTop] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">(
    "saved"
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const pendingUpdatesRef = useRef<Record<string, unknown>>({});
  const lastFailedPayloadRef = useRef<Record<string, unknown> | null>(null);

  const doSave = useCallback(async (updates: Record<string, unknown>) => {
    setSaveStatus("saving");
    try {
      const res = await fetch(`/api/notes/${noteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.status === 401) {
        router.push(
          `/login?returnTo=${encodeURIComponent(`/notes/${noteId}/floating`)}`
        );
        return;
      }
      if (!res.ok) throw new Error("Save failed");
      const updated: Note = await res.json();
      setSaveStatus("saved");
      lastFailedPayloadRef.current = null;
    } catch {
      setSaveStatus("error");
      lastFailedPayloadRef.current = updates;
    }
  }, [noteId, router]);

  const saveRef = useRef(doSave);
  saveRef.current = doSave;

  const debouncedSave = useCallback((updates: Record<string, unknown>) => {
    Object.assign(pendingUpdatesRef.current, updates);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSaveStatus("saving");
    debounceRef.current = setTimeout(() => {
      const pending = { ...pendingUpdatesRef.current };
      pendingUpdatesRef.current = {};
      saveRef.current(pending);
    }, DEBOUNCE_MS);
  }, []);

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

  // Persist legacy-data normalization once on mount
  useEffect(() => {
    if (initialChecklist.changed && initialNote.mode === "checklist") {
      immediateSave({
        checklistItems: initialChecklist.items,
        checklistGroups: initialChecklist.groups,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      const pending = { ...pendingUpdatesRef.current };
      if (Object.keys(pending).length > 0) {
        fetch(`/api/notes/${noteId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(pending),
          keepalive: true,
        }).catch(() => {});
      }
    };
  }, [noteId]);

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
      .then(setAlwaysOnTop)
      .catch((e) => console.error("get_always_on_top failed:", e));
  }, []);

  const handleAlwaysOnTopToggle = async () => {
    try {
      setAlwaysOnTop(await toggleAlwaysOnTop());
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

  const handleDelete = () => {
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    setDeleteConfirmOpen(false);
    try {
      const res = await fetch(`/api/notes/${noteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      router.push("/");
    } catch {
      alert("删除失败");
    }
  };

  const handleRetry = async () => {
    if (!lastFailedPayloadRef.current) return;
    await immediateSave({ ...lastFailedPayloadRef.current });
  };

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

  return (
    <div className="flex flex-col h-screen w-full p-2.5 sm:p-3">
      {/* Minimal header */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <button
          onClick={() => router.push("/")}
          className="p-1 hover:bg-black/[0.04] rounded-btn transition-colors"
          title="返回"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
        <div className="flex-1" />
        <SaveStatus status={saveStatus} onRetry={handleRetry} />
        <ImageUploadButton
          noteId={noteId}
          onUploaded={(uploaded) =>
            setAttachments((prev) => [...prev, ...uploaded])
          }
        />
        <button
          onClick={handleModeSwitch}
          className={`text-xs px-2 py-1 rounded-btn transition-colors ${
            mode === "checklist"
              ? "bg-primary/10 text-primary"
              : "text-ink-secondary hover:bg-black/[0.04]"
          }`}
          title="切换模式"
        >
          {mode === "checklist" ? "便签" : "待办"}
        </button>
        <button
          onClick={handlePinToggle}
          className={`p-1 rounded-btn transition-colors ${
            isPinned
              ? "text-primary bg-primary/10"
              : "text-ink-muted hover:bg-black/[0.04]"
          }`}
          title={isPinned ? "取消置顶" : "置顶"}
        >
          <svg
            className="w-4 h-4"
            fill={isPinned ? "currentColor" : "none"}
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
            />
          </svg>
        </button>
        {isTauri() && (
          <button
            onClick={handleAlwaysOnTopToggle}
            className={`p-1 rounded-btn transition-colors ${
              alwaysOnTop
                ? "text-primary bg-primary/10"
                : "text-ink-muted hover:bg-black/[0.04]"
            }`}
            title={alwaysOnTop ? "取消窗口置顶" : "窗口置顶"}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 3v3m6-3v3M5 6h14v2a2 2 0 01-2 2H7a2 2 0 01-2-2V6zM12 10v9m-3 2h6"
              />
            </svg>
          </button>
        )}
        <button
          onClick={handleDelete}
          className="p-1 text-ink-muted hover:text-danger hover:bg-danger/5 rounded-btn transition-colors"
          title="删除"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </button>
      </div>

      {/* Editor body */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin space-y-3">
        <input
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="无标题便签"
          className="w-full text-lg font-semibold border-none outline-none bg-transparent placeholder:text-[#C7C7CC]"
        />

        <ColorPicker selected={color} onChange={handleColorChange} />

        {mode === "text" ? (
          <AutoGrowTextarea
            value={content}
            onChange={handleContentChange}
            placeholder="开始记录..."
            className="w-full border-none outline-none bg-transparent text-sm leading-relaxed placeholder:text-[#C7C7CC]"
            minHeight={120}
          />
        ) : (
          <div className="text-sm">
            <ChecklistEditor
              items={checklistItems}
              groups={checklistGroups}
              onChange={handleChecklistChange}
            />
          </div>
        )}

        {/* Image attachments */}
        <ImageAttachments
          noteId={noteId}
          attachments={attachments}
          onAttachmentsChange={setAttachments}
        />
      </div>

      <ConfirmDialog
        open={deleteConfirmOpen}
        title="删除便签"
        message="确定删除此便签？删除后可在回收站恢复。"
        confirmLabel="删除"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirmOpen(false)}
      />
    </div>
  );
}
