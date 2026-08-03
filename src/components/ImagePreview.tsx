"use client";

import { useEffect, useRef } from "react";
import type { Attachment } from "@/types";

interface Props {
  attachment: Attachment;
  onClose: () => void;
  onDelete?: (att: Attachment) => void;
}

export default function ImagePreview({ attachment, onClose, onDelete }: Props) {
  const imgRef = useRef<HTMLImageElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Prevent body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col items-center max-w-[92vw] max-h-[94vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between w-full mb-3">
          <p className="text-sm text-white/60 truncate max-w-[60%]">
            {attachment.filename}
          </p>
          <div className="flex items-center gap-2">
            {onDelete && (
              <button
                onClick={() => onDelete(attachment)}
                className="flex items-center justify-center w-11 h-11 md:w-9 md:h-9 text-white/70 hover:text-red-400 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                aria-label="删除图片"
                title="删除图片"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
            <button
              onClick={onClose}
              className="flex items-center justify-center w-11 h-11 md:w-9 md:h-9 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors"
              aria-label="关闭"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Image */}
        <img
          ref={imgRef}
          src={attachment.url}
          alt={attachment.filename}
          className="max-w-full max-h-[80vh] object-contain rounded-modal shadow-2xl"
        />

        {/* Bottom info */}
        <div className="mt-3 flex items-center gap-3 text-xs text-white/40">
          {attachment.width && attachment.height && (
            <span>{attachment.width} × {attachment.height}</span>
          )}
          {attachment.size > 0 && (
            <span>{(attachment.size / 1024).toFixed(0)} KB</span>
          )}
        </div>
      </div>
    </div>
  );
}
