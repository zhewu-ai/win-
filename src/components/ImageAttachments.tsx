"use client";

import { useState } from "react";
import type { Attachment } from "@/types";
import ImagePreview from "./ImagePreview";
import ConfirmDialog from "./ConfirmDialog";

interface Props {
  noteId: string;
  attachments: Attachment[];
  onAttachmentsChange: (attachments: Attachment[]) => void;
}

export default function ImageAttachments({
  noteId,
  attachments,
  onAttachmentsChange,
}: Props) {
  const [previewAtt, setPreviewAtt] = useState<Attachment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Attachment | null>(null);

  const handleDelete = (att: Attachment) => {
    setDeleteTarget(att);
  };

  const confirmDelete = async () => {
    const att = deleteTarget;
    setDeleteTarget(null);
    setPreviewAtt(null);
    if (!att) return;

    let res: Response | null = null;
    try {
      res = await fetch(
        `/api/notes/${noteId}/attachments/${att.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      onAttachmentsChange(attachments.filter((a) => a.id !== att.id));
    } catch (e) {
      console.error("删除图片失败:", e);
      alert(
        res ? `删除图片失败（HTTP ${res.status}）` : "删除图片失败，请检查网络"
      );
    }
  };

  if (attachments.length === 0) return null;

  return (
    <div>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {attachments.map((att) => (
          <div key={att.id} className="relative group aspect-square rounded-thumb overflow-hidden bg-surface-hover ring-1 ring-border-soft">
            <img
              src={att.url}
              alt={att.filename}
              className="w-full h-full object-cover cursor-pointer"
              onClick={() => setPreviewAtt(att)}
              onError={(e) => {
                const target = e.currentTarget;
                target.style.display = "none";
                const parent = target.parentElement;
                if (parent) {
                  const placeholder = document.createElement("div");
                  placeholder.className = "w-full h-full flex items-center justify-center text-ink-muted text-list-meta";
                  placeholder.textContent = "加载失败";
                  parent.appendChild(placeholder);
                }
              }}
            />
            <button
              onClick={() => handleDelete(att)}
              className="absolute top-1 right-1 w-7 h-7 bg-black/55 hover:bg-black/75 rounded-full flex items-center justify-center transition-colors"
              title="删除图片"
            >
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {previewAtt && (
        <ImagePreview
          attachment={previewAtt}
          onClose={() => setPreviewAtt(null)}
          onDelete={handleDelete}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="删除图片"
        message="确定删除这张图片？此操作不会删除便签内容。"
        confirmLabel="删除"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
