"use client";

import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { Attachment } from "@/types";
import { useSyncStatus } from "@/hooks/useSyncStatus";

export interface ImageUploadHandle {
  open: () => void;
  /** 直接上传图片文件（拖拽/粘贴复用同一套上传逻辑）。 */
  uploadFiles: (files: File[]) => Promise<void>;
}

interface Props {
  noteId: string;
  onUploaded: (attachments: Attachment[]) => void;
  /** true 时不渲染按钮，仅保留隐藏 input 与上传逻辑，由父组件经 ref 触发。 */
  hidden?: boolean;
}

const ImageUploadButton = forwardRef<ImageUploadHandle, Props>(
  function ImageUploadButton({ noteId, onUploaded, hidden }, ref) {
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { isOnline } = useSyncStatus();

    const handleSelectFiles = () => {
      if (!isOnline || uploading) return;
      fileInputRef.current?.click();
    };

    // 拖拽/粘贴上传共用：离线拦截、非图片过滤、循环上传、onUploaded 收尾。
    const uploadFiles = async (files: File[]) => {
      if (uploading) return;
      if (!isOnline) {
        const msg = "离线模式下暂不支持上传图片";
        if (hidden) alert(msg);
        else setError(msg);
        return;
      }
      const images = Array.from(files).filter((f) => f.type.startsWith("image/"));
      if (images.length === 0) {
        const msg = "仅支持上传图片";
        if (hidden) alert(msg);
        else setError(msg);
        return;
      }
      setError(null);
      setUploading(true);
      try {
        const uploaded: Attachment[] = [];
        for (const file of images) {
          const formData = new FormData();
          formData.append("file", file);

          const res = await fetch(`/api/notes/${noteId}/attachments`, {
            method: "POST",
            body: formData,
          });

          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            // 额度超限时优先展示服务端友好文案（STORAGE_QUOTA_EXCEEDED → message）
            const friendly =
              typeof data.message === "string" ? data.message : undefined;
            throw new Error(friendly || data.error || "Upload failed");
          }

          const data = await res.json();
          uploaded.push(data.attachment);
        }
        onUploaded(uploaded);
      } catch (err) {
        const message = err instanceof Error ? err.message : "上传失败";
        setError(message);
        // 按钮隐藏时（入口在更多菜单）无法展示内联标签，用 alert 兜底提示
        if (hidden) alert(`上传失败：${message}`);
      } finally {
        setUploading(false);
      }
    };

    useImperativeHandle(ref, () => ({ open: handleSelectFiles, uploadFiles }));

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      await uploadFiles(Array.from(files));
      // Reset file input so re-selecting same file triggers change
      if (fileInputRef.current) fileInputRef.current.value = "";
    };

    if (hidden) {
      return (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
      );
    }

    return (
      <div className="relative">
        <button
          onClick={handleSelectFiles}
          disabled={uploading || !isOnline}
          className={`flex items-center justify-center w-icon-btn h-icon-btn rounded-btn transition-colors ${
            error
              ? "text-danger hover:bg-danger/10"
              : "text-ink-muted hover:text-ink hover:bg-surface-hover"
          } ${uploading ? "opacity-60 animate-pulse" : ""} ${
            !isOnline ? "opacity-40 cursor-not-allowed hover:bg-transparent hover:text-ink-muted" : ""
          }`}
          title={
            !isOnline
              ? "离线模式下暂不支持上传图片"
              : error
                ? "上传失败，点击重试"
                : uploading
                  ? "上传中..."
                  : "添加图片"
          }
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
          <span className="absolute bottom-full mb-1 right-0 whitespace-nowrap text-[11px] text-danger bg-panel-bg rounded-btn px-1.5 py-0.5 shadow-sm border border-danger/20">
            上传失败
          </span>
        )}
      </div>
    );
  }
);

export default ImageUploadButton;
