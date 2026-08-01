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
