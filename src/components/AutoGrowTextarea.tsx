"use client";

import { useEffect, useRef } from "react";

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: number;
}

export default function AutoGrowTextarea({
  value,
  onChange,
  placeholder,
  className,
  minHeight,
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const syncHeight = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  useEffect(() => {
    syncHeight();
    window.addEventListener("resize", syncHeight);
    return () => window.removeEventListener("resize", syncHeight);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={className}
      style={{
        overflow: "hidden",
        minHeight,
        resize: "none",
      }}
    />
  );
}
