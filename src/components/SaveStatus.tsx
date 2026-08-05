interface Props {
  status: "saved" | "saving" | "error";
  onRetry?: () => void;
  showText?: boolean;
}

export default function SaveStatus({ status, onRetry, showText = true }: Props) {
  const textCls = showText ? "inline" : "hidden";
  if (status === "saving") {
    return (
      <span className="text-list-meta text-ink-muted/60 flex items-center gap-1 whitespace-nowrap">
        <span className="w-1.5 h-1.5 bg-ink-muted/40 rounded-full animate-pulse" />
        <span className={textCls}>保存中</span>
      </span>
    );
  }

  if (status === "error") {
    return (
      <span className="text-list-meta text-danger flex items-center gap-1 whitespace-nowrap">
        <span className="w-1.5 h-1.5 bg-danger rounded-full" />
        <span className={textCls}>
          保存失败
          {onRetry && (
            <button
              onClick={onRetry}
              className="underline hover:text-danger/80 font-medium"
            >
              重试
            </button>
          )}
        </span>
      </span>
    );
  }

  return (
    <span className="text-list-meta text-ink-muted/40 flex items-center gap-1 whitespace-nowrap">
      <span className="w-1.5 h-1.5 bg-ink-muted/30 rounded-full" />
      <span className={textCls}>已保存</span>
    </span>
  );
}
