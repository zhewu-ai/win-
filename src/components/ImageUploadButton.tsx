"use client";

import { useRef, useState } from "react";
import type { Attachment } from "@/types";

interface Props {
  noteId: string;
  onUploaded: (attachments: Attachment[]) => void;
}

export default function ImageUploadButton({ noteId, onUploaded }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSelectFiles = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setError(null);
    setUploading(true);

    try {
      const uploaded: Attachment[] = [];
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch(`/api/notes/${noteId}/attachments`, {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Upload failed");
        }

        const data = await res.json();
        uploaded.push(data.attachment);
      }
      onUploaded(uploaded);
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败");
    } finally {
      setUploading(false);
      // Reset file input so re-selecting same file triggers change
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="relative">
      <button
        onClick={handleSelectFiles}
        disabled={uploading}
        className={`flex items-center justify-center w-icon-btn h-icon-btn rounded-btn transition-colors ${
          error
            ? "text-danger hover:bg-danger/10"
            : "text-ink-muted hover:text-ink hover:bg-white/[0.08]"
        } ${uploading ? "opacity-60 animate-pulse" : ""}`}
        title={error ? "上传失败，点击重试" : uploading ? "上传中..." : "添加图片"}
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />
      {error && (
        <span className="absolute bottom-full mb-1 right-0 whitespace-nowrap text-[11px] text-danger bg-white rounded-btn px-1.5 py-0.5 shadow-sm border border-danger/20">
          上传失败
        </span>
      )}
    </div>
  );
}
