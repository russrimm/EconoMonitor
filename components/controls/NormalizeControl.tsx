'use client';

import { Select } from './Select';
import { NORMALIZE_MAP, NORMALIZE_MODES, type NormalizeMode } from '@/lib/transform';

interface Props {
  mode: NormalizeMode;
  onChange: (mode: NormalizeMode) => void;
}

export function NormalizeControl({ mode, onChange }: Props) {
  return (
    <Select<NormalizeMode>
      label="Scale"
      value={mode}
      title={NORMALIZE_MAP[mode]?.description}
      options={NORMALIZE_MODES.map((m) => ({
        value: m.value,
        label: m.label,
        title: m.description,
      }))}
      onChange={onChange}
    />
  );
}
