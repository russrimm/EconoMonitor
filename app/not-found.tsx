import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="py-20 text-center">
      <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>
        Page not found
      </h1>
      <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
        The requested EconoMonitor page does not exist.
      </p>
      <Link
        href="/"
        className="mt-5 inline-block rounded-lg px-4 py-2 text-sm font-medium"
        style={{ background: 'var(--accent)', color: '#fff' }}
      >
        Open dashboard
      </Link>
    </div>
  );
}
