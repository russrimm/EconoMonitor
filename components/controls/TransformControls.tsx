'use client';

import { Select } from './Select';
import {
  AGGREGATIONS,
  TRANSFORMS,
  TRANSFORM_MAP,
  aggregatableFrequencies,
  type FredAggregation,
  type FredFrequency,
  type FredUnits,
} from '@/lib/fred';

interface Props {
  units: FredUnits;
  onUnitsChange: (units: FredUnits) => void;
  /**
   * Series' native `frequency_short`. When provided and the series can be
   * aggregated to a lower frequency, the frequency + aggregation pickers show.
   */
  nativeFrequencyShort?: string;
  frequency?: FredFrequency;
  onFrequencyChange?: (frequency: FredFrequency) => void;
  aggregation?: FredAggregation;
  onAggregationChange?: (aggregation: FredAggregation) => void;
}

export function TransformControls({
  units,
  onUnitsChange,
  nativeFrequencyShort,
  frequency = '',
  onFrequencyChange,
  aggregation = 'avg',
  onAggregationChange,
}: Props) {
  const frequencyOptions = nativeFrequencyShort
    ? aggregatableFrequencies(nativeFrequencyShort)
    : [];
  const showFrequency = !!onFrequencyChange && frequencyOptions.length > 0;

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <Select<FredUnits>
        label="Units"
        value={units}
        title={TRANSFORM_MAP[units]?.description}
        options={TRANSFORMS.map((t) => ({
          value: t.value,
          label: t.label,
          title: t.description,
        }))}
        onChange={onUnitsChange}
      />

      {showFrequency && onFrequencyChange && (
        <Select<FredFrequency>
          label="Frequency"
          value={frequency}
          title="Aggregate the series to a lower frequency before charting."
          options={[
            { value: '' as FredFrequency, label: 'Native' },
            ...frequencyOptions.map((f) => ({
              value: f.value as FredFrequency,
              label: f.label,
            })),
          ]}
          onChange={onFrequencyChange}
        />
      )}

      {showFrequency && frequency && onAggregationChange && (
        <Select<FredAggregation>
          label="Aggregate by"
          value={aggregation}
          options={AGGREGATIONS.map((a) => ({
            value: a.value,
            label: a.label,
            title: a.description,
          }))}
          onChange={onAggregationChange}
        />
      )}
    </div>
  );
}
