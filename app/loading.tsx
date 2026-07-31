export default function Loading() {
  return (
    <div className="animate-pulse" aria-label="Loading page" aria-busy="true">
      <div className="mb-6 h-8 w-64 rounded" style={{ background: 'var(--border)' }} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="h-44 rounded-xl"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          />
        ))}
      </div>
    </div>
  );
}
