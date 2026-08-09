import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const series = {
  id: 'GDP',
  title: 'Gross Domestic Product',
  frequency: 'Quarterly',
  frequency_short: 'Q',
  units: 'Billions of Dollars',
  units_short: 'Bil. of $',
  seasonal_adjustment: 'Seasonally Adjusted Annual Rate',
  seasonal_adjustment_short: 'SAAR',
  observation_start: '1947-01-01',
  observation_end: '2026-04-01',
  last_updated: '2026-07-30 07:55:01-05',
  popularity: 90,
};

async function mockPublicApis(page: Page) {
  await page.route('**/api/fred/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/releases/dates')) {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          release_dates: [{
            release_id: 53,
            release_name: 'Gross Domestic Product',
            date: '2026-08-01',
          }],
        }),
      });
      return;
    }
    if (url.pathname.endsWith('/series/observations')) {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          count: 2,
          observations: [
            { date: '2026-01-01', value: '30000' },
            { date: '2026-04-01', value: '30500' },
          ],
        }),
      });
      return;
    }
    if (url.pathname.endsWith('/series')) {
      const id = url.searchParams.get('series_id') ?? 'GDP';
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          seriess: [{ ...series, id, title: id === 'UNRATE' ? 'Unemployment Rate' : series.title }],
        }),
      });
      return;
    }
    if (url.pathname.endsWith('/releases')) {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          count: 2,
          offset: 0,
          limit: 50,
          releases: [
            { id: 1, name: 'Gross Domestic Product', press_release: true },
            { id: 2, name: 'Consumer Price Index', press_release: false },
          ],
        }),
      });
      return;
    }
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ seriess: [], count: 0, offset: 0, limit: 20 }),
    });
  });

  await page.route('**/api/news?**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        articles: [{
          url: 'https://example.com/story',
          title: 'Economic outlook improves',
          publishedAt: '2026-07-31T12:00:00.000Z',
          source: 'example.com',
          sourceCountry: 'United States',
        }],
        updatedAt: '2026-07-31T12:01:00.000Z',
        providers: ['GDELT'],
        partial: false,
      }),
    });
  });

  await page.route('**/api/rates', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        curve: {
          latest: {
            date: '2026-08-07',
            points: [
              { label: '3M', months: 3, percent: 3.87 },
              { label: '2Y', months: 24, percent: 4.19 },
              { label: '10Y', months: 120, percent: 4.65 },
              { label: '30Y', months: 360, percent: 5.19 },
            ],
          },
          monthAgo: {
            date: '2026-07-31',
            points: [
              { label: '3M', months: 3, percent: 3.9 },
              { label: '10Y', months: 120, percent: 4.6 },
            ],
          },
          yearAgo: null,
          spreads: [
            { label: '10Y − 2Y', shortLabel: '2Y', longLabel: '10Y', basisPoints: 46 },
            { label: '10Y − 3M', shortLabel: '3M', longLabel: '10Y', basisPoints: 78 },
          ],
        },
        referenceRates: [{
          type: 'SOFR',
          label: 'Secured Overnight Financing Rate',
          effectiveDate: '2026-08-06',
          percent: 3.65,
          volumeInBillions: 3055,
          targetRateFrom: null,
          targetRateTo: null,
          percentile1: 3.61,
          percentile25: 3.63,
          percentile75: 3.68,
          percentile99: 3.73,
          revised: false,
        }],
        referenceRateHistory: [{
          type: 'SOFR',
          label: 'Secured Overnight Financing Rate',
          points: [
            {
              effectiveDate: '2026-08-05',
              percent: 3.66,
              percentile1: 3.62,
              percentile99: 3.74,
              volumeInBillions: 3020,
            },
            {
              effectiveDate: '2026-08-06',
              percent: 3.65,
              percentile1: 3.61,
              percentile99: 3.73,
              volumeInBillions: 3055,
            },
          ],
        }],
        sofrAverages: null,
        updatedAt: '2026-08-07T12:00:00.000Z',
        providers: ['U.S. Treasury', 'New York Fed'],
        partial: false,
      }),
    });
  });

  await page.route('**/api/energy', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        series: [{
          id: 'RWTC',
          label: 'WTI crude oil spot',
          unit: '$/barrel',
          category: 'Crude oil',
          latest: { date: '2026-08-05', value: 66.2 },
          changeOnWeek: 1.7,
          changeOnYear: -4.2,
          observations: [
            { date: '2026-07-29', value: 65.1 },
            { date: '2026-08-05', value: 66.2 },
          ],
        }],
        updatedAt: '2026-08-07T12:00:00.000Z',
        partial: false,
        configured: true,
      }),
    });
  });

  await page.route('**/api/regional', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        stateGdp: {
          period: '2026Q1',
          unit: 'Millions of chained 2017 dollars',
          states: [{
            fips: '01000',
            name: 'Alabama',
            period: '2026Q1',
            value: 210000,
            changeOnQuarter: 1.94,
            changeOnYear: 5,
          }],
        },
        indicators: [{
          id: 'retail-sales',
          label: 'Advance retail and food services sales',
          unit: '$M',
          note: 'Seasonally adjusted.',
          group: 'Retail and wholesale trade',
          frequency: 'monthly',
          latest: { date: '2026-06-01', value: 720000 },
          changeOnMonth: 0.4,
          changeOnYear: 3.1,
          observations: [{ date: '2026-06-01', value: 720000 }],
        }, {
          id: 'homeownership-rate',
          label: 'Homeownership rate',
          unit: '%',
          note: 'Seasonally adjusted.',
          group: 'Housing and construction',
          frequency: 'quarterly',
          latest: { date: '2026-04-01', value: 65.2 },
          changeOnMonth: 0.2,
          changeOnYear: 0.5,
          observations: [{ date: '2026-04-01', value: 65.2 }],
        }],
        updatedAt: '2026-08-07T12:00:00.000Z',
        partial: false,
        beaConfigured: true,
        censusConfigured: true,
      }),
    });
  });

  await page.route('**/api/markets', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        soma: {
          latest: {
            asOfDate: '2026-08-05',
            bills: 195_000_000_000,
            notesBonds: 3_900_000_000_000,
            frn: 50_000_000_000,
            tips: 380_000_000_000,
            tipsInflationCompensation: 20_000_000_000,
            mbs: 1_800_000_000_000,
            cmbs: null,
            agencies: 2_000_000_000,
            total: 6_356_005_243_485,
          },
          yearAgo: {
            asOfDate: '2025-07-30',
            bills: 190_000_000_000,
            notesBonds: 4_000_000_000_000,
            frn: 50_000_000_000,
            tips: 375_000_000_000,
            tipsInflationCompensation: 19_000_000_000,
            mbs: 2_000_000_000_000,
            cmbs: null,
            agencies: 2_000_000_000,
            total: 6_600_000_000_000,
          },
          history: [
            { asOfDate: '2026-07-29', total: 6_360_000_000_000 },
            { asOfDate: '2026-08-05', total: 6_356_005_243_485 },
          ],
        },
        repoOperations: [{
          operationId: '2026-08-07-repo',
          operationType: 'Repo',
          operationMethod: 'Fixed Rate',
          operationDate: '2026-08-07',
          maturityDate: '2026-08-08',
          term: 'Overnight',
          totalAmountSubmitted: 1_000_000_000,
          totalAmountAccepted: 1_000_000_000,
          acceptedCounterparties: 3,
          details: [{
            securityType: 'Treasury',
            amountSubmitted: 1_000_000_000,
            amountAccepted: 1_000_000_000,
            percentOfferingRate: 3.75,
            percentAwardRate: 3.75,
            percentWeightedAverageRate: null,
          }],
        }],
        primaryDealers: [{
          keyId: 'PDPOSGST-TOT',
          label: 'Net Treasury positions',
          note: 'Net outright positions in U.S. Treasury securities.',
          asOfDate: '2026-07-29',
          value: 473171,
        }],
        updatedAt: '2026-08-07T12:00:00.000Z',
        providers: ['New York Fed'],
        partial: false,
      }),
    });
  });
}

async function expectAccessible(
  page: Page,
  path: string,
  waitForLoadedState: (page: Page) => Promise<void>,
) {
  await mockPublicApis(page);
  await page.goto(path);
  await waitForLoadedState(page);
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(
    results.violations,
    results.violations
      .map((violation) =>
        `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`,
      )
      .join('\n'),
  ).toEqual([]);
}

test('dashboard has no automated WCAG A/AA violations', async ({ page }) => {
  await expectAccessible(page, '/', async (loadedPage) => {
    await loadedPage.getByRole('img', { name: /recent trend chart/ }).first().waitFor();
  });
});

test('builder has no automated WCAG A/AA violations', async ({ page }) => {
  await expectAccessible(page, '/builder', async (loadedPage) => {
    await loadedPage.getByRole('heading', { name: 'Indicator Builder' }).waitFor();
  });
});

test('news has no automated WCAG A/AA violations', async ({ page }) => {
  await expectAccessible(page, '/news', async (loadedPage) => {
    await loadedPage.getByRole('heading', { name: 'Economic outlook improves' }).waitFor();
  });
});

test('compare has no automated WCAG A/AA violations', async ({ page }) => {
  await expectAccessible(page, '/compare?ids=GDP,UNRATE', async (loadedPage) => {
    await loadedPage.getByRole('img', { name: /Comparison chart/ }).waitFor();
  });
});

test('rates has no automated WCAG A/AA violations', async ({ page }) => {
  await expectAccessible(page, '/rates', async (loadedPage) => {
    await loadedPage.getByRole('img', { name: /Treasury par yield curve/ }).waitFor();
  });
});

test('energy has no automated WCAG A/AA violations', async ({ page }) => {
  await expectAccessible(page, '/energy', async (loadedPage) => {
    await loadedPage.getByRole('heading', { name: 'WTI crude oil spot' }).waitFor();
  });
});

test('regional has no automated WCAG A/AA violations', async ({ page }) => {
  await expectAccessible(page, '/regional', async (loadedPage) => {
    await loadedPage
      .getByRole('heading', { name: /Real GDP by state/ })
      .waitFor();
  });
});

test('markets has no automated WCAG A/AA violations', async ({ page }) => {
  await expectAccessible(page, '/markets', async (loadedPage) => {
    await loadedPage.getByRole('heading', { name: 'SOMA holdings' }).waitFor();
  });
});

// Axe accepts `placeholder` as an accessible-name source, so the WCAG A/AA scans above
// still pass if an explicit `aria-label` is deleted while a placeholder remains. That was
// verified empirically: stripping only the search input's aria-label left all eight scans
// green, and axe's `label` rule fired only once the placeholder was ALSO removed.
//
// Placeholder-only naming is not equivalent. The visible text disappears as soon as the
// user types, placeholder contrast is typically below the AA threshold, and some assistive
// technology does not expose it at all. So the automated scans cannot be the only guard
// here; this asserts the explicit name source directly.
test('form controls are named explicitly, not by placeholder alone', async ({ page }) => {
  await mockPublicApis(page);
  await page.goto('/');

  const unnamed = await page.locator('input:visible, textarea:visible, select:visible').evaluateAll(
    (elements) =>
      elements
        .filter((element) => {
          const ariaLabel = element.getAttribute('aria-label')?.trim();
          if (ariaLabel) return false;
          if (element.getAttribute('aria-labelledby')?.trim()) return false;
          if (element.id && document.querySelector(`label[for="${CSS.escape(element.id)}"]`)) {
            return false;
          }
          return !element.closest('label');
        })
        .map((element) => {
          const placeholder = element.getAttribute('placeholder') ?? '';
          return `<${element.tagName.toLowerCase()}${
            placeholder ? ` placeholder="${placeholder}"` : ''
          }> class="${element.className}"`;
        }),
  );

  expect(
    unnamed,
    `Controls relying on placeholder or title for their accessible name:\n${unnamed.join('\n')}`,
  ).toEqual([]);
});

test('keyboard users can skip repeated navigation', async ({ page }) => {
  await mockPublicApis(page);
  await page.goto('/');

  await page.keyboard.press('Tab');
  const skipLink = page.getByRole('link', { name: 'Skip to content' });
  await expect(skipLink).toBeFocused();
  await skipLink.press('Enter');
  await expect(page.locator('main#main-content')).toBeFocused();
});

test('mobile navigation and release filters describe their scope', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await mockPublicApis(page);
  await page.goto('/releases');

  const mobileNav = page.locator('nav[aria-label="Primary"]:visible');
  await expect(mobileNav).toBeVisible();
  await expect(mobileNav.getByRole('link', { name: 'Releases' })).toHaveAttribute(
    'aria-current',
    'page',
  );

  const filter = page.getByRole('textbox', {
    name: 'Filter releases on this page by name',
  });
  await filter.fill('Gross');
  await expect(page.getByRole('status')).toContainText(
    '1 of 2 releases on this page shown',
  );
});
