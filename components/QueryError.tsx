interface QueryErrorProps {
  message: string;
  onRetry: () => void;
  retryLabel?: string;
}

export function QueryError({
  message,
  onRetry,
  retryLabel = 'Retry',
}: QueryErrorProps) {
  return (
    <div
      className="flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm"
      role="alert"
      style={{
        background: 'color-mix(in srgb, var(--red) 10%, transparent)',
        color: 'var(--red)',
        border: '1px solid color-mix(in srgb, var(--red) 30%, transparent)',
      }}
    >
      <span>{message}</span>
      <button
        type="button"
        onClick={onRetry}
        className="shrink-0 font-medium underline focus-visible:ring-2"
      >
        {retryLabel}
      </button>
    </div>
  );
}
