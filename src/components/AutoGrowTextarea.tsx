"use client";

import { useEffect, useRef } from "react";

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: number;
  maxHeight?: number;
  innerRef?: React.Ref<HTMLTextAreaElement>;
  onFocus?: React.FocusEventHandler<HTMLTextAreaElement>;
  onBlur?: React.FocusEventHandler<HTMLTextAreaElement>;
  onKeyDown?: React.KeyboardEventHandler<HTMLTextAreaElement>;
  onPaste?: React.ClipboardEventHandler<HTMLTextAreaElement>;
}

export default function AutoGrowTextarea({
  value,
  onChange,
  placeholder,
  className,
  minHeight,
  maxHeight,
  innerRef,
  onFocus,
  onBlur,
  onKeyDown,
  onPaste,
}: Props) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  const setRefs = (el: HTMLTextAreaElement | null) => {
    ref.current = el;
    if (typeof innerRef === "function") innerRef(el);
    else if (innerRef) (innerRef as { current: HTMLTextAreaElement | null }).current = el;
  };

  const syncHeight = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    const target = maxHeight ? Math.min(el.scrollHeight, maxHeight) : el.scrollHeight;
    el.style.height = `${target}px`;
  };

  useEffect(() => {
    syncHeight();
    window.addEventListener("resize", syncHeight);
    return () => window.removeEventListener("resize", syncHeight);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, maxHeight]);

  return (
    <textarea
      ref={setRefs}
      rows={1}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      onFocus={onFocus}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
      className={className}
      style={{
        overflow: maxHeight ? "auto" : "hidden",
        minHeight,
        maxHeight,
        resize: "none",
      }}
    />
  );
}
