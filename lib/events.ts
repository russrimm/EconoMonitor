// ─── Historical event registry ───────────────────────────────────────────────
// Curated list of macro-economic and policy events used to annotate FRED time
// series. Each event links to a FRASER full-text search so users can dig into
// contemporaneous Federal Reserve documents about the period.
//
// Dates are ISO (YYYY-MM-DD). Where an event spans a period (e.g. a recession)
// we keep both `date` (the headline / start) and an optional `endDate` so the
// chart can shade the range.

export type EventCategory =
  | 'recession'
  | 'monetary'
  | 'crisis'
  | 'policy'
  | 'shock'
  | 'milestone';

export interface HistoricalEvent {
  id: string;
  title: string;
  /** Headline date — used for vertical line placement. */
  date: string;
  /** Optional period end date — when set, the chart shades the range. */
  endDate?: string;
  category: EventCategory;
  /** One-line description shown in the event list. */
  summary: string;
  /** Optional FRASER search query. Defaults to the title. */
  fraserQuery?: string;
}

export const EVENTS: HistoricalEvent[] = [
  // ─── Pre-WWII ──────────────────────────────────────────────────────────────
  {
    id: 'crash-1929',
    title: 'Stock market crash',
    date: '1929-10-29',
    category: 'crisis',
    summary: 'Black Tuesday — Dow falls 12%, igniting the Great Depression.',
    fraserQuery: '1929 stock market crash',
  },
  {
    id: 'great-depression',
    title: 'Great Depression',
    date: '1929-08-01',
    endDate: '1933-03-01',
    category: 'recession',
    summary: 'Deep contraction; unemployment peaked above 24%.',
  },
  {
    id: 'gold-standard-suspended',
    title: 'US suspends gold standard',
    date: '1933-04-19',
    category: 'monetary',
    summary: 'FDR takes the dollar off domestic gold convertibility.',
  },
  {
    id: 'banking-act-1933',
    title: 'Glass–Steagall (Banking Act)',
    date: '1933-06-16',
    category: 'policy',
    summary: 'Separates commercial and investment banking; FDIC created.',
  },

  // ─── Postwar / Bretton Woods era ───────────────────────────────────────────
  {
    id: 'bretton-woods-end',
    title: 'Nixon shock — end of Bretton Woods',
    date: '1971-08-15',
    category: 'monetary',
    summary: 'US suspends dollar convertibility to gold; floating FX begins.',
  },
  {
    id: 'oil-shock-1973',
    title: 'OPEC oil embargo',
    date: '1973-10-17',
    endDate: '1974-03-01',
    category: 'shock',
    summary: 'Oil prices roughly quadruple, triggering stagflation.',
    fraserQuery: '1973 oil embargo',
  },
  {
    id: 'oil-shock-1979',
    title: 'Iranian Revolution oil shock',
    date: '1979-01-01',
    endDate: '1980-04-01',
    category: 'shock',
    summary: 'Iranian revolution disrupts oil supply; second oil crisis.',
  },
  {
    id: 'volcker-shock',
    title: 'Volcker disinflation',
    date: '1979-10-06',
    endDate: '1982-08-01',
    category: 'monetary',
    summary: 'Fed funds pushed above 19% to break double-digit inflation.',
    fraserQuery: 'Volcker disinflation',
  },
  {
    id: 'recession-1981',
    title: '1981–82 recession',
    date: '1981-07-01',
    endDate: '1982-11-01',
    category: 'recession',
    summary: 'Volcker-era contraction; unemployment peaks near 11%.',
  },

  // ─── 1980s–1990s ───────────────────────────────────────────────────────────
  {
    id: 'plaza-accord',
    title: 'Plaza Accord',
    date: '1985-09-22',
    category: 'monetary',
    summary: 'G5 agree to depreciate the US dollar against the yen and DM.',
  },
  {
    id: 'black-monday',
    title: 'Black Monday',
    date: '1987-10-19',
    category: 'crisis',
    summary: 'Dow drops 22.6% in a single session.',
  },
  {
    id: 'sl-crisis',
    title: 'Savings & loan crisis peak',
    date: '1989-08-09',
    category: 'crisis',
    summary: 'FIRREA signed; RTC formed to resolve failed thrifts.',
  },
  {
    id: 'recession-1990',
    title: '1990–91 recession',
    date: '1990-07-01',
    endDate: '1991-03-01',
    category: 'recession',
    summary: 'Mild contraction following Gulf War oil spike.',
  },
  {
    id: 'asian-crisis',
    title: 'Asian financial crisis',
    date: '1997-07-02',
    endDate: '1998-12-01',
    category: 'crisis',
    summary: 'Thai baht devaluation cascades through emerging Asia.',
  },
  {
    id: 'ltcm',
    title: 'LTCM bailout',
    date: '1998-09-23',
    category: 'crisis',
    summary: 'NY Fed brokers a private rescue of Long-Term Capital Management.',
  },

  // ─── 2000s ─────────────────────────────────────────────────────────────────
  {
    id: 'dotcom-peak',
    title: 'Dot-com peak',
    date: '2000-03-10',
    category: 'milestone',
    summary: 'Nasdaq Composite hits 5,048; bubble begins to deflate.',
  },
  {
    id: 'recession-2001',
    title: '2001 recession',
    date: '2001-03-01',
    endDate: '2001-11-01',
    category: 'recession',
    summary: 'Tech bust and post-9/11 demand shock.',
  },
  {
    id: 'sept-11',
    title: 'September 11 attacks',
    date: '2001-09-11',
    category: 'shock',
    summary: 'Markets close for four days; Fed injects emergency liquidity.',
  },
  {
    id: 'lehman',
    title: 'Lehman Brothers fails',
    date: '2008-09-15',
    category: 'crisis',
    summary: 'Largest bankruptcy in US history; GFC enters acute phase.',
    fraserQuery: 'Lehman Brothers 2008',
  },
  {
    id: 'gfc',
    title: 'Global Financial Crisis',
    date: '2007-12-01',
    endDate: '2009-06-01',
    category: 'recession',
    summary: 'Housing bust and bank runs; deepest postwar US recession.',
  },
  {
    id: 'qe1',
    title: 'QE1 announced',
    date: '2008-11-25',
    category: 'monetary',
    summary: 'Fed begins large-scale asset purchases of MBS and Treasuries.',
  },

  // ─── 2010s ─────────────────────────────────────────────────────────────────
  {
    id: 'euro-crisis',
    title: 'Euro sovereign debt crisis',
    date: '2010-04-23',
    endDate: '2012-09-06',
    category: 'crisis',
    summary: 'Greek bailout requested; ECB OMT eventually calms markets.',
  },
  {
    id: 'us-debt-downgrade',
    title: 'US sovereign debt downgrade',
    date: '2011-08-05',
    category: 'shock',
    summary: 'S&P cuts US rating from AAA to AA+ after debt-ceiling standoff.',
  },
  {
    id: 'taper-tantrum',
    title: 'Taper tantrum',
    date: '2013-05-22',
    category: 'monetary',
    summary: 'Bernanke signals QE wind-down; long yields spike.',
  },
  {
    id: 'china-deval-2015',
    title: 'China yuan devaluation',
    date: '2015-08-11',
    category: 'shock',
    summary: 'PBoC fixes yuan ~2% lower; global risk-off follows.',
  },
  {
    id: 'brexit-vote',
    title: 'Brexit referendum',
    date: '2016-06-23',
    category: 'shock',
    summary: 'UK votes to leave EU; sterling drops sharply.',
  },

  // ─── 2020s ─────────────────────────────────────────────────────────────────
  {
    id: 'covid-shock',
    title: 'COVID-19 market crash',
    date: '2020-02-20',
    endDate: '2020-04-30',
    category: 'shock',
    summary: 'Pandemic shutdowns; Fed cuts to ZLB and restarts QE.',
    fraserQuery: 'COVID-19 pandemic Federal Reserve',
  },
  {
    id: 'cares-act',
    title: 'CARES Act signed',
    date: '2020-03-27',
    category: 'policy',
    summary: '$2.2T fiscal package — direct payments, PPP, expanded UI.',
  },
  {
    id: 'inflation-surge',
    title: 'Post-COVID inflation surge',
    date: '2021-05-01',
    endDate: '2022-06-01',
    category: 'shock',
    summary: 'Headline CPI runs from ~5% to a 9.1% peak in June 2022.',
  },
  {
    id: 'russia-ukraine',
    title: 'Russia invades Ukraine',
    date: '2022-02-24',
    category: 'shock',
    summary: 'Energy and food prices spike; Western sanctions imposed.',
  },
  {
    id: 'fed-hike-cycle-2022',
    title: 'Fed begins hiking cycle',
    date: '2022-03-16',
    category: 'monetary',
    summary: 'First 25bp hike of the fastest tightening since the early 1980s.',
  },
  {
    id: 'svb-collapse',
    title: 'Silicon Valley Bank fails',
    date: '2023-03-10',
    endDate: '2023-05-01',
    category: 'crisis',
    summary: 'Regional banking turmoil; BTFP launched, Signature & First Republic also fail.',
  },
  {
    id: 'fed-cuts-2024',
    title: 'Fed begins cutting cycle',
    date: '2024-09-18',
    category: 'monetary',
    summary: '50bp cut — first easing of the post-COVID cycle.',
  },
];

const FRASER_SEARCH = 'https://fraser.stlouisfed.org/search?query=';

/** Build a FRASER full-text search URL for an event. */
export function fraserSearchUrl(event: HistoricalEvent): string {
  const q = event.fraserQuery ?? event.title;
  return FRASER_SEARCH + encodeURIComponent(q);
}

/** Filter events that fall within (or overlap) a date range. */
export function eventsInRange(
  events: HistoricalEvent[],
  startDate: string,
  endDate: string,
): HistoricalEvent[] {
  return events.filter((e) => {
    const eStart = e.date;
    const eEnd = e.endDate ?? e.date;
    return eEnd >= startDate && eStart <= endDate;
  });
}

/** Color palette per event category — matched to the existing theme. */
export const CATEGORY_COLOR: Record<EventCategory, string> = {
  recession:  '#64748b', // slate
  monetary:   '#3b82f6', // blue
  crisis:     '#ef4444', // red
  policy:     '#10b981', // emerald
  shock:      '#f59e0b', // amber
  milestone:  '#8b5cf6', // violet
};
