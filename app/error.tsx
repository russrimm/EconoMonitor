'use client';

import { AlertTriangle } from 'lucide-react';

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 py-20 text-center" role="alert">
      <AlertTriangle className="h-8 w-8" style={{ color: 'var(--red)' }} />
      <div>
        <h1 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>
          This page could not be loaded
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
          The data service may be temporarily unavailable.
        </p>
      </div>
      <button
        onClick={reset}
        className="rounded-lg px-4 py-2 text-sm font-medium"
        style={{ background: 'var(--accent)', color: '#fff' }}
      >
        Try again
      </button>
    </div>
  );
}
