'use client';

import { ChevronDown } from 'lucide-react';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  title?: string;
}

interface Props<T extends string> {
  label: string;
  value: T;
  title?: string;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
}

/** Compact labelled dropdown used by the chart control bars. */
export function Select<T extends string>({
  label,
  value,
  title,
  options,
  onChange,
}: Props<T>) {
  return (
    <label className="flex items-center gap-1.5" title={title}>
      <span
        className="text-xs font-medium uppercase tracking-wide whitespace-nowrap"
        style={{ color: 'var(--text-muted)' }}
      >
        {label}
      </span>
      <span className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as T)}
          className="appearance-none pl-2.5 pr-7 py-1 rounded-md text-sm font-medium focus:outline-none focus:ring-2 cursor-pointer"
          style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            // @ts-expect-error css var
            '--tw-ring-color': 'var(--accent)',
          }}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} title={o.title}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
          style={{ color: 'var(--text-muted)' }}
        />
      </span>
    </label>
  );
}
