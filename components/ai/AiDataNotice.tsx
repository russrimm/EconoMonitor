import { ShieldCheck } from 'lucide-react';

interface Props {
  kind: 'chat' | 'data';
}

export function AiDataNotice({ kind }: Props) {
  return (
    <p
      className="flex items-start gap-1.5 text-[11px] leading-relaxed"
      style={{ color: 'var(--text-muted)' }}
    >
      <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>
        {kind === 'chat'
          ? 'Your conversation is sent to the configured AI provider. Do not enter personal, confidential, or regulated information.'
          : 'The selected series labels and chart values are sent to the configured AI provider when you run this analysis.'}
      </span>
    </p>
  );
}
