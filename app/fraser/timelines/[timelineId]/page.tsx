'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Clock } from 'lucide-react';
import { useFraserTimeline, useTimelineEvents } from '@/hooks/useFraserQuery';
import {
  getEventTitle,
  getEventDate,
  getEventDescription,
  extractUrl,
  type FraserTimelineEvent,
} from '@/lib/fraser';

function EventCard({ event, index }: { event: FraserTimelineEvent; index: number }) {
  const title = getEventTitle(event);
  const date = getEventDate(event);
  const description = getEventDescription(event);
  const fraserUrl = extractUrl(event.location);

  // Format a readable date if it looks like YYYY-MM-DD
  const displayDate = date
    ? (() => {
        const d = new Date(date);
        return isNaN(d.getTime())
          ? date
          : d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      })()
    : null;

  return (
    <div className="flex gap-4">
      {/* Timeline spine */}
      <div className="flex flex-col items-center">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
          style={{
            background: 'color-mix(in srgb, var(--accent) 15%, transparent)',
            color: 'var(--accent)',
            border: '2px solid color-mix(in srgb, var(--accent) 40%, transparent)',
          }}
        >
          {index + 1}
        </div>
        {/* vertical connector added via CSS in parent */}
      </div>

      {/* Content */}
      <div
        className="flex-1 mb-6 rounded-xl p-4 flex flex-col gap-1.5"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        {displayDate && (
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />
            <span className="text-xs font-medium" style={{ color: 'var(--accent)' }}>
              {displayDate}
            </span>
          </div>
        )}
        <p className="text-sm font-semibold leading-snug" style={{ color: 'var(--text)' }}>
          {fraserUrl !== '#' ? (
            <a
              href={fraserUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              {title}
            </a>
          ) : title}
        </p>
        {description && (
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            {description}
          </p>
        )}
      </div>
    </div>
  );
}

export default function TimelinePage() {
  const { timelineId } = useParams<{ timelineId: string }>();

  const timelineQuery = useFraserTimeline(timelineId);
  const eventsQuery = useTimelineEvents(timelineId);

  const timeline = timelineQuery.data?.records?.[0];
  const rawEvents = eventsQuery.data?.records ?? [];

  // Sort chronologically by date
  const events = [...rawEvents].sort((a, b) => {
    const da = getEventDate(a);
    const db = getEventDate(b);
    return da.localeCompare(db);
  });

  const title = timeline?.title ?? timelineId;
  const blurb = timeline?.abstract || timeline?.description;

  return (
    <div className="flex flex-col gap-6">
      {/* Back */}
      <Link
        href="/fraser"
        className="inline-flex items-center gap-1.5 text-sm hover:underline self-start"
        style={{ color: 'var(--text-muted)' }}
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Archives
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-2">
        {timelineQuery.isLoading ? (
          <div className="h-8 w-72 rounded animate-pulse" style={{ background: 'var(--surface)' }} />
        ) : (
          <>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
              {timeline?.url ? (
                <a
                  href={timeline.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  {title}
                </a>
              ) : title}
            </h1>
            {blurb && (
              <p className="text-sm leading-relaxed max-w-3xl" style={{ color: 'var(--text-muted)' }}>
                {blurb}
              </p>
            )}
          </>
        )}
      </div>

      {/* Error */}
      {eventsQuery.error && (
        <div
          className="rounded-xl px-4 py-3 text-sm"
          style={{
            background: 'color-mix(in srgb, var(--red) 10%, transparent)',
            color: 'var(--red)',
            border: '1px solid color-mix(in srgb, var(--red) 30%, transparent)',
          }}
        >
          Failed to load timeline events.
        </div>
      )}

      {/* Events count */}
      {events.length > 0 && (
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {events.length} events · sorted chronologically
        </p>
      )}

      {/* Timeline */}
      {eventsQuery.isLoading ? (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-20 rounded-xl animate-pulse"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col">
          {events.map((event, i) => (
            <EventCard key={i} event={event} index={i} />
          ))}
          {events.length === 0 && !eventsQuery.isLoading && (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              No events found for this timeline.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
