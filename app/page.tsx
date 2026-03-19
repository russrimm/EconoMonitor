'use client';

import { Plus, Search, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { usePinnedSeries } from '@/hooks/usePinnedSeries';
import { useReleaseDates } from '@/hooks/useFredQuery';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { formatDate } from '@/lib/utils';

export default function DashboardPage() {
  const { pinned, toggle, isPinned, hydrated } = usePinnedSeries();
  const { data: releaseDatesData } = useReleaseDates();

  const upcomingReleases = (releaseDatesData?.release_dates ?? []).slice(0, 8);

  if (!hydrated) {
    return (
      <div className="animate-pulse">
        <div
          className="h-8 rounded w-64 mb-6"
          style={{ background: 'var(--border)' }}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl p-4 h-44"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
            Dashboard
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {pinned.length} pinned indicator{pinned.length !== 1 ? 's' : ''} · data
            from the FRED® St. Louis Fed
          </p>
        </div>
        <Link
          href="/search"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium"
          style={{
            background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
            color: 'var(--accent)',
            border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)',
          }}
        >
          <Plus className="w-4 h-4" />
          Add indicator
        </Link>
      </div>

      {/* Metric cards */}
      {pinned.length === 0 ? (
        <div
          className="rounded-xl p-12 flex flex-col items-center gap-4 text-center"
          style={{ background: 'var(--surface)', border: '1px dashed var(--border)' }}
        >
          <TrendingUp className="w-10 h-10" style={{ color: 'var(--text-muted)' }} />
          <div>
            <p className="font-semibold" style={{ color: 'var(--text)' }}>
              No pinned indicators
            </p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              Search for a series and pin it to your dashboard.
            </p>
          </div>
          <Link
            href="/search"
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            <Search className="w-4 h-4" />
            Browse series
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {pinned.map((id) => (
            <MetricCard
              key={id}
              seriesId={id}
              isPinned={isPinned(id)}
              onToggle={toggle}
            />
          ))}
        </div>
      )}

      {/* Recent releases strip */}
      {upcomingReleases.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
              Recent &amp; Upcoming Releases
            </h2>
            <Link
              href="/releases"
              className="text-xs font-medium"
              style={{ color: 'var(--accent)' }}
            >
              View all →
            </Link>
          </div>
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: '1px solid var(--border)' }}
          >
            <table className="w-full text-sm">
              <thead
                style={{
                  background: 'var(--surface-2)',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <tr>
                  <th
                    className="text-left px-4 py-2 font-medium text-xs uppercase tracking-wide"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    Release
                  </th>
                  <th
                    className="text-right px-4 py-2 font-medium text-xs uppercase tracking-wide"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    Date
                  </th>
                </tr>
              </thead>
              <tbody>
                {upcomingReleases.map((rd, i) => (
                  <tr
                    key={i}
                    style={{
                      borderTop: i > 0 ? '1px solid var(--border)' : undefined,
                      background: 'var(--surface)',
                    }}
                  >
                    <td className="px-4 py-2.5" style={{ color: 'var(--text)' }}>
                      {rd.release_name}
                    </td>
                    <td
                      className="px-4 py-2.5 text-right font-mono text-xs"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {formatDate(rd.date)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
