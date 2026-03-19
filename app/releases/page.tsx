'use client';

import { useState } from 'react';
import { Calendar, ExternalLink } from 'lucide-react';
import { useReleases } from '@/hooks/useFredQuery';

export default function ReleasesPage() {
  const [offset, setOffset] = useState(0);
  const { data, isLoading, error } = useReleases(offset);

  const releases = data?.releases ?? [];
  const total = data?.count ?? 0;
  const totalPages = Math.ceil(total / 50);
  const currentPage = Math.floor(offset / 50) + 1;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
          Data Releases
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          All FRED economic data releases
          {total > 0 && ` · ${total.toLocaleString()} total`}
        </p>
      </div>

      {/* Error */}
      {error && (
        <div
          className="rounded-xl px-4 py-3 text-sm"
          style={{
            background: 'color-mix(in srgb, var(--red) 10%, transparent)',
            color: 'var(--red)',
            border: '1px solid color-mix(in srgb, var(--red) 30%, transparent)',
          }}
        >
          Failed to load releases. Please try again.
        </div>
      )}

      {/* Table */}
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
                className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wide"
                style={{ color: 'var(--text-muted)' }}
              >
                Release Name
              </th>
              <th
                className="text-center px-4 py-3 font-medium text-xs uppercase tracking-wide hidden sm:table-cell"
                style={{ color: 'var(--text-muted)' }}
              >
                Press Release
              </th>
              <th
                className="text-right px-4 py-3 font-medium text-xs uppercase tracking-wide"
                style={{ color: 'var(--text-muted)' }}
              >
                Link
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 15 }).map((_, i) => (
                  <tr
                    key={i}
                    style={{
                      borderTop: '1px solid var(--border)',
                      background: 'var(--surface)',
                    }}
                  >
                    <td className="px-4 py-3">
                      <div
                        className="h-4 rounded animate-pulse w-3/4"
                        style={{ background: 'var(--border)' }}
                      />
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell" />
                    <td className="px-4 py-3" />
                  </tr>
                ))
              : releases.map((release, i) => (
                  <tr
                    key={release.id}
                    className="transition-colors"
                    style={{
                      borderTop: i > 0 ? '1px solid var(--border)' : undefined,
                      background: 'var(--surface)',
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = 'var(--surface-2)')
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = 'var(--surface)')
                    }
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Calendar
                          className="w-4 h-4 shrink-0"
                          style={{ color: 'var(--accent)' }}
                        />
                        <span className="font-medium" style={{ color: 'var(--text)' }}>
                          {release.name}
                        </span>
                      </div>
                    </td>
                    <td
                      className="px-4 py-3 text-center hidden sm:table-cell"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {release.press_release ? (
                        <span
                          className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{
                            background:
                              'color-mix(in srgb, var(--accent) 12%, transparent)',
                            color: 'var(--accent)',
                          }}
                        >
                          Yes
                        </span>
                      ) : (
                        <span className="text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {release.link ? (
                        <a
                          href={release.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs"
                          style={{ color: 'var(--accent)' }}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Source
                        </a>
                      ) : (
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          —
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setOffset(Math.max(0, offset - 50))}
            disabled={currentPage <= 1}
            className="px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-40"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
            }}
          >
            ← Prev
          </button>
          <span className="text-sm px-2" style={{ color: 'var(--text-muted)' }}>
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => setOffset(offset + 50)}
            disabled={currentPage >= totalPages}
            className="px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-40"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
            }}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
