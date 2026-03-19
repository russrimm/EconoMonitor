'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { exportToCSV, exportToJSON } from '@/lib/utils';
import type { FredObservation } from '@/lib/fred';

interface Props {
  seriesId: string;
  title: string;
  observations: FredObservation[];
}

export function ExportButton({ seriesId, title, observations }: Props) {
  const [open, setOpen] = useState(false);

  function handleCSV() {
    exportToCSV(seriesId, title, observations);
    setOpen(false);
  }

  function handleJSON() {
    exportToJSON(seriesId, title, observations);
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
        style={{
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          color: 'var(--text)',
        }}
      >
        <Download className="w-4 h-4" />
        Export
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          {/* Dropdown */}
          <div
            className="absolute right-0 mt-1 w-36 rounded-lg shadow-lg z-20 py-1 text-sm"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <button
              onClick={handleCSV}
              className="w-full px-3 py-2 text-left transition-colors"
              style={{ color: 'var(--text)' }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = 'var(--surface-2)')
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = 'transparent')
              }
            >
              Download CSV
            </button>
            <button
              onClick={handleJSON}
              className="w-full px-3 py-2 text-left transition-colors"
              style={{ color: 'var(--text)' }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = 'var(--surface-2)')
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = 'transparent')
              }
            >
              Download JSON
            </button>
          </div>
        </>
      )}
    </div>
  );
}
