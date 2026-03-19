/**
 * Curated registry of well-known FRED series IDs mapped to plain-English names,
 * short descriptions, and topic categories.
 *
 * Used throughout the app to translate cryptic codes into human-readable labels
 * and to power the browsable / filterable indicator picker on the Insights page.
 */

export interface Indicator {
  id: string;
  name: string;           // plain-English short name (≤ 50 chars)
  description: string;    // one-sentence explanation
  category: IndicatorCategory;
  frequency: string;      // rough update cadence
}

export type IndicatorCategory =
  | 'GDP & Growth'
  | 'Employment'
  | 'Inflation & Prices'
  | 'Interest Rates'
  | 'Inflation Expectations'
  | 'Real Interest Rates'
  | 'Money & Banking'
  | 'Housing'
  | 'Trade & International'
  | 'Consumer & Confidence'
  | 'Energy & Commodities'
  | 'Financial Markets';

export const INDICATOR_CATEGORIES: IndicatorCategory[] = [
  'GDP & Growth',
  'Employment',
  'Inflation & Prices',
  'Interest Rates',
  'Inflation Expectations',
  'Real Interest Rates',
  'Money & Banking',
  'Housing',
  'Trade & International',
  'Consumer & Confidence',
  'Energy & Commodities',
  'Financial Markets',
];

export const INDICATORS: Indicator[] = [
  // ── GDP & Growth ─────────────────────────────────────────────────────────
  {
    id: 'GDP',
    name: 'Gross Domestic Product',
    description: 'Total value of goods and services produced in the US economy, the broadest measure of economic output.',
    category: 'GDP & Growth',
    frequency: 'Quarterly',
  },
  {
    id: 'GDPC1',
    name: 'Real GDP (Inflation-Adjusted)',
    description: 'GDP adjusted for inflation using 2017 chained dollars — the standard measure of real economic growth.',
    category: 'GDP & Growth',
    frequency: 'Quarterly',
  },
  {
    id: 'A191RL1Q225SBEA',
    name: 'Real GDP Growth Rate',
    description: 'Quarter-over-quarter percentage change in real GDP, seasonally adjusted at annual rate.',
    category: 'GDP & Growth',
    frequency: 'Quarterly',
  },
  {
    id: 'PCECC96',
    name: 'Real Personal Consumption Expenditures',
    description: 'Inflation-adjusted household spending on goods and services — the largest component of GDP.',
    category: 'GDP & Growth',
    frequency: 'Monthly',
  },
  {
    id: 'GFDEGDQ188S',
    name: 'Federal Debt as % of GDP',
    description: 'Total public debt held by the federal government expressed as a share of annual GDP.',
    category: 'GDP & Growth',
    frequency: 'Quarterly',
  },

  // ── Employment ───────────────────────────────────────────────────────────
  {
    id: 'UNRATE',
    name: 'Unemployment Rate',
    description: 'Percentage of the labor force that is jobless and actively seeking employment.',
    category: 'Employment',
    frequency: 'Monthly',
  },
  {
    id: 'U6RATE',
    name: 'Underemployment Rate (U-6)',
    description: 'Broad unemployment including part-time workers who want full-time jobs and marginally attached workers.',
    category: 'Employment',
    frequency: 'Monthly',
  },
  {
    id: 'PAYEMS',
    name: 'Total Nonfarm Payrolls',
    description: 'Total number of paid US workers excluding farm workers, government, and private household employees.',
    category: 'Employment',
    frequency: 'Monthly',
  },
  {
    id: 'CIVPART',
    name: 'Labor Force Participation Rate',
    description: 'Share of the civilian non-institutional population that is either employed or actively looking for work.',
    category: 'Employment',
    frequency: 'Monthly',
  },
  {
    id: 'ICSA',
    name: 'Initial Jobless Claims',
    description: 'Number of people filing for unemployment benefits for the first time in a given week.',
    category: 'Employment',
    frequency: 'Weekly',
  },
  {
    id: 'CES0500000003',
    name: 'Average Hourly Earnings',
    description: 'Average hourly wage for all private-sector employees — a key measure of wage inflation.',
    category: 'Employment',
    frequency: 'Monthly',
  },
  {
    id: 'JTSJOL',
    name: 'Job Openings (JOLTS)',
    description: 'Total number of unfilled job positions at the end of the month across all industries.',
    category: 'Employment',
    frequency: 'Monthly',
  },

  // ── Inflation & Prices ───────────────────────────────────────────────────
  {
    id: 'CPIAUCSL',
    name: 'Consumer Price Index (CPI)',
    description: 'Measures price changes for a basket of goods purchased by urban consumers — the most widely followed inflation gauge.',
    category: 'Inflation & Prices',
    frequency: 'Monthly',
  },
  {
    id: 'CPILFESL',
    name: 'Core CPI (Excluding Food & Energy)',
    description: 'CPI stripped of volatile food and energy prices — used by the Fed to assess underlying inflation.',
    category: 'Inflation & Prices',
    frequency: 'Monthly',
  },
  {
    id: 'PCEPI',
    name: 'PCE Price Index',
    description: 'Personal Consumption Expenditures price index — the Federal Reserve\'s preferred inflation measure.',
    category: 'Inflation & Prices',
    frequency: 'Monthly',
  },
  {
    id: 'PCEPILFE',
    name: 'Core PCE Price Index',
    description: 'PCE inflation excluding food and energy — the Fed\'s primary inflation target metric (2% target).',
    category: 'Inflation & Prices',
    frequency: 'Monthly',
  },
  {
    id: 'PPIFIS',
    name: 'Producer Price Index (PPI)',
    description: 'Measures price changes received by domestic producers — often a leading indicator of consumer inflation.',
    category: 'Inflation & Prices',
    frequency: 'Monthly',
  },
  {
    id: 'DCOILWTICO',
    name: 'WTI Crude Oil Price',
    description: 'Spot price of West Texas Intermediate crude oil in USD per barrel — a key commodity price benchmark.',
    category: 'Energy & Commodities',
    frequency: 'Daily',
  },

  // ── Interest Rates ───────────────────────────────────────────────────────
  {
    id: 'DFF',
    name: 'Federal Funds Rate',
    description: 'The overnight lending rate between banks set by the Federal Reserve — the key monetary policy tool.',
    category: 'Interest Rates',
    frequency: 'Daily',
  },
  {
    id: 'DFEDTARU',
    name: 'Fed Funds Target Rate Upper Bound',
    description: 'Upper bound of the Federal Reserve\'s target range for the federal funds rate.',
    category: 'Interest Rates',
    frequency: 'Daily',
  },
  {
    id: 'DGS10',
    name: '10-Year Treasury Yield',
    description: 'Yield on 10-year US Treasury notes — a benchmark for mortgage rates and long-term borrowing costs.',
    category: 'Interest Rates',
    frequency: 'Daily',
  },
  {
    id: 'DGS2',
    name: '2-Year Treasury Yield',
    description: 'Yield on 2-year US Treasury notes — sensitive to near-term Federal Reserve rate expectations.',
    category: 'Interest Rates',
    frequency: 'Daily',
  },
  {
    id: 'DGS30',
    name: '30-Year Treasury Yield',
    description: 'Yield on 30-year US Treasury bonds — reflects long-term inflation and growth expectations.',
    category: 'Interest Rates',
    frequency: 'Daily',
  },
  {
    id: 'T10Y2Y',
    name: 'Yield Curve: 10Y minus 2Y Spread',
    description: 'Difference between 10-year and 2-year Treasury yields. Turns negative (inverted) before most recessions.',
    category: 'Interest Rates',
    frequency: 'Daily',
  },
  {
    id: 'T10Y3M',
    name: 'Yield Curve: 10Y minus 3M Spread',
    description: 'Spread between 10-year Treasury yield and 3-month bill — another widely watched recession predictor.',
    category: 'Interest Rates',
    frequency: 'Daily',
  },
  {
    id: 'MORTGAGE30US',
    name: '30-Year Fixed Mortgage Rate',
    description: 'Average interest rate on a 30-year fixed-rate home mortgage in the United States.',
    category: 'Interest Rates',
    frequency: 'Weekly',
  },
  {
    id: 'PRIME',
    name: 'Bank Prime Loan Rate',
    description: 'Interest rate that commercial banks charge their most creditworthy customers — typically Fed Funds + 3%.',
    category: 'Interest Rates',
    frequency: 'Daily',
  },

  // ── Inflation Expectations ───────────────────────────────────────────────
  {
    id: 'MICH',
    name: 'UMich 1-Year Inflation Expectation',
    description: 'University of Michigan survey: median expected price change over the next 12 months among US consumers.',
    category: 'Inflation Expectations',
    frequency: 'Monthly',
  },
  {
    id: 'EXPINF1YR',
    name: '1-Year Expected Inflation Rate',
    description: 'Market-implied 1-year inflation expectation derived from inflation swaps by the Federal Reserve Bank of Cleveland.',
    category: 'Inflation Expectations',
    frequency: 'Monthly',
  },
  {
    id: 'EXPINF10YR',
    name: '10-Year Expected Inflation Rate',
    description: 'Market-implied 10-year inflation expectation derived from inflation swaps by the Federal Reserve Bank of Cleveland.',
    category: 'Inflation Expectations',
    frequency: 'Monthly',
  },
  {
    id: 'T10YIE',
    name: '10-Year Breakeven Inflation Rate',
    description: 'Difference between 10-year nominal and TIPS yields — the market\'s expectation for average inflation over 10 years.',
    category: 'Inflation Expectations',
    frequency: 'Daily',
  },
  {
    id: 'T5YIE',
    name: '5-Year Breakeven Inflation Rate',
    description: 'Market-implied average inflation expectation over the next 5 years from TIPS and nominal Treasury spreads.',
    category: 'Inflation Expectations',
    frequency: 'Daily',
  },
  {
    id: 'T5YIFR',
    name: '5-Year Forward Inflation Expectation (5y5y)',
    description: 'Expected inflation between 5 and 10 years from now — closely watched by the Federal Reserve.',
    category: 'Inflation Expectations',
    frequency: 'Daily',
  },

  // ── Real Interest Rates ──────────────────────────────────────────────────
  {
    id: 'REAINTRATREARAT10Y',
    name: '10-Year Real Interest Rate',
    description: 'Yield on 10-year Treasury Inflation-Protected Securities (TIPS) — the nominal 10Y yield minus inflation expectations.',
    category: 'Real Interest Rates',
    frequency: 'Daily',
  },
  {
    id: 'REAINTRATREARAT1YE',
    name: '1-Year Real Interest Rate',
    description: 'Real (inflation-adjusted) 1-year interest rate derived from nominal yields and inflation expectations.',
    category: 'Real Interest Rates',
    frequency: 'Monthly',
  },
  {
    id: 'DFII10',
    name: '10-Year TIPS Yield',
    description: 'Yield on 10-year Treasury Inflation-Protected Securities — a direct market measure of real interest rates.',
    category: 'Real Interest Rates',
    frequency: 'Daily',
  },
  {
    id: 'DFII5',
    name: '5-Year TIPS Yield',
    description: 'Yield on 5-year Treasury Inflation-Protected Securities — real return demanded by investors over 5 years.',
    category: 'Real Interest Rates',
    frequency: 'Daily',
  },

  // ── Money & Banking ──────────────────────────────────────────────────────
  {
    id: 'M2SL',
    name: 'Money Supply M2',
    description: 'Total money supply including cash, checking deposits, savings, and money market funds — broad measure of liquidity.',
    category: 'Money & Banking',
    frequency: 'Monthly',
  },
  {
    id: 'WALCL',
    name: 'Fed Balance Sheet (Total Assets)',
    description: 'Total assets held by the Federal Reserve System — expands during quantitative easing, contracts during QT.',
    category: 'Money & Banking',
    frequency: 'Weekly',
  },
  {
    id: 'TOTRESNS',
    name: 'Total Bank Reserves',
    description: 'Total reserves held by depository institutions at the Federal Reserve — indicates banking system liquidity.',
    category: 'Money & Banking',
    frequency: 'Monthly',
  },
  {
    id: 'DPSACBW027SBOG',
    name: 'Commercial Bank Deposits',
    description: 'Total deposits at all commercial banks in the US — a broad measure of banking system funding.',
    category: 'Money & Banking',
    frequency: 'Weekly',
  },

  // ── Housing ──────────────────────────────────────────────────────────────
  {
    id: 'HOUST',
    name: 'Housing Starts',
    description: 'Number of new residential construction projects begun each month — a leading economic indicator.',
    category: 'Housing',
    frequency: 'Monthly',
  },
  {
    id: 'HSN1F',
    name: 'New Home Sales',
    description: 'Number of newly built single-family homes sold each month across the United States.',
    category: 'Housing',
    frequency: 'Monthly',
  },
  {
    id: 'EXHOSLUSM495S',
    name: 'Existing Home Sales',
    description: 'Number of previously owned homes sold each month — the largest segment of the housing market.',
    category: 'Housing',
    frequency: 'Monthly',
  },
  {
    id: 'CSUSHPISA',
    name: 'S&P/Case-Shiller Home Price Index',
    description: 'Composite index of home prices in 20 major US cities — the benchmark for tracking US home values.',
    category: 'Housing',
    frequency: 'Monthly',
  },
  {
    id: 'MEDLISPRI',
    name: 'Median Listing Price of Homes',
    description: 'Median asking price for active residential listings across the US — from Realtor.com data.',
    category: 'Housing',
    frequency: 'Monthly',
  },

  // ── Trade & International ────────────────────────────────────────────────
  {
    id: 'BOPGSTB',
    name: 'US Trade Balance (Goods)',
    description: 'Difference between US goods exports and imports — a negative value means more is imported than exported.',
    category: 'Trade & International',
    frequency: 'Monthly',
  },
  {
    id: 'DTWEXBGS',
    name: 'US Dollar Index (Broad)',
    description: 'Trade-weighted value of the US dollar against a basket of major trading partner currencies.',
    category: 'Trade & International',
    frequency: 'Daily',
  },
  {
    id: 'EXUSEU',
    name: 'USD / EUR Exchange Rate',
    description: 'Number of US dollars required to purchase one euro — a key global currency pair.',
    category: 'Trade & International',
    frequency: 'Daily',
  },

  // ── Consumer & Confidence ────────────────────────────────────────────────
  {
    id: 'UMCSENT',
    name: 'Consumer Sentiment (UMich)',
    description: 'University of Michigan index measuring consumer confidence in personal finances and the overall economy.',
    category: 'Consumer & Confidence',
    frequency: 'Monthly',
  },
  {
    id: 'CSCICP03USM665S',
    name: 'Consumer Confidence Index (OECD)',
    description: 'OECD measure of household optimism about the economy, spending, and saving — normalised around 100.',
    category: 'Consumer & Confidence',
    frequency: 'Monthly',
  },
  {
    id: 'RSAFS',
    name: 'Retail Sales',
    description: 'Total receipts at stores that sell merchandise — captures consumer spending on goods.',
    category: 'Consumer & Confidence',
    frequency: 'Monthly',
  },
  {
    id: 'PCE',
    name: 'Personal Consumption Expenditures',
    description: 'Total household spending on goods and services — accounts for roughly 70% of US GDP.',
    category: 'Consumer & Confidence',
    frequency: 'Monthly',
  },

  // ── Energy & Commodities ─────────────────────────────────────────────────
  {
    id: 'GASREGCOVW',
    name: 'Regular Gasoline Price (US Average)',
    description: 'Average retail price of regular unleaded gasoline across the United States.',
    category: 'Energy & Commodities',
    frequency: 'Weekly',
  },
  {
    id: 'GOLDAMGBD228NLBM',
    name: 'Gold Price (London Fix)',
    description: 'Daily gold price in USD per troy ounce from the London Bullion Market Association afternoon fix.',
    category: 'Energy & Commodities',
    frequency: 'Daily',
  },

  // ── Financial Markets ────────────────────────────────────────────────────
  {
    id: 'SP500',
    name: 'S&P 500 Index',
    description: 'Market-cap weighted index of 500 large US companies — the most widely followed US stock market benchmark.',
    category: 'Financial Markets',
    frequency: 'Daily',
  },
  {
    id: 'NASDAQCOM',
    name: 'NASDAQ Composite Index',
    description: 'Index of over 3 000 equities listed on the NASDAQ exchange, heavily weighted toward technology stocks.',
    category: 'Financial Markets',
    frequency: 'Daily',
  },
  {
    id: 'VIXCLS',
    name: 'VIX Volatility Index',
    description: 'CBOE Volatility Index — measures expected 30-day stock market volatility. Called the "fear gauge".',
    category: 'Financial Markets',
    frequency: 'Daily',
  },
  {
    id: 'BAMLH0A0HYM2',
    name: 'High-Yield Bond Spread',
    description: 'Spread between high-yield (junk) corporate bonds and Treasuries — widens during financial stress.',
    category: 'Financial Markets',
    frequency: 'Daily',
  },
  {
    id: 'TEDRATE',
    name: 'TED Spread',
    description: 'Difference between 3-month LIBOR and 3-month T-bill yield — a measure of credit and liquidity risk.',
    category: 'Financial Markets',
    frequency: 'Daily',
  },
];

/** Quick lookup map: series ID → Indicator */
export const INDICATOR_MAP: Record<string, Indicator> = Object.fromEntries(
  INDICATORS.map((ind) => [ind.id, ind]),
);

/**
 * Returns a plain-English name for a series ID if it exists in the registry,
 * otherwise returns the ID itself unchanged.
 */
export function getIndicatorName(seriesId: string): string {
  return INDICATOR_MAP[seriesId]?.name ?? seriesId;
}

/**
 * Filters the curated indicator list by a plain-text search query and optional category.
 */
export function filterIndicators(
  query: string,
  category?: IndicatorCategory | '',
): Indicator[] {
  const q = query.toLowerCase().trim();
  return INDICATORS.filter((ind) => {
    const matchCat = !category || ind.category === category;
    if (!matchCat) return false;
    if (!q) return true;
    return (
      ind.id.toLowerCase().includes(q) ||
      ind.name.toLowerCase().includes(q) ||
      ind.description.toLowerCase().includes(q) ||
      ind.category.toLowerCase().includes(q)
    );
  });
}
