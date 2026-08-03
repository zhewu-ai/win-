interface Props {
  status: "saved" | "saving" | "error";
  onRetry?: () => void;
}

export default function SaveStatus({ status, onRetry }: Props) {
  if (status === "saving") {
    return (
      <span className="text-list-meta text-ink-muted/60 flex items-center gap-1 whitespace-nowrap">
        <span className="w-1.5 h-1.5 bg-ink-muted/40 rounded-full animate-pulse" />
        <span className="hidden sm:inline">保存中</span>
      </span>
    );
  }

  if (status === "error") {
    return (
      <span className="text-list-meta text-danger flex items-center gap-1 whitespace-nowrap">
        <span className="w-1.5 h-1.5 bg-danger rounded-full" />
        <span className="hidden sm:inline">
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
      <span className="hidden sm:inline">已保存</span>
    </span>
  );
}
