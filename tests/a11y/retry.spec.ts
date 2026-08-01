import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function expectReachableRetry(
  page: Page,
  path: string,
  apiPattern: string,
  message: string,
) {
  let requests = 0;
  await page.route(apiPattern, async (route) => {
    requests += 1;
    await route.fulfill({
      status: 502,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Temporary upstream failure.' }),
    });
  });

  await page.goto(path);
  const alert = page.getByRole('alert').filter({ hasText: message }).first();
  await expect(alert).toBeVisible();

  const retry = alert.getByRole('button', { name: 'Retry' });
  await expect(retry).toBeVisible();
  await retry.focus();
  await expect(retry).toBeFocused();

  const beforeRetry = requests;
  await page.keyboard.press('Enter');
  await expect.poll(() => requests).toBeGreaterThan(beforeRetry);

  const results = await new AxeBuilder({ page })
    .include('main')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations).toEqual([]);
}

test('category detail exposes an announced keyboard retry', async ({ page }) => {
  await expectReachableRetry(
    page,
    '/categories/0',
    '**/api/fred/**',
    'Some category data could not be loaded.',
  );
});

test('FRASER title header exposes an announced keyboard retry', async ({ page }) => {
  await expectReachableRetry(
    page,
    '/fraser/title/1',
    '**/api/fraser/**',
    'Title details could not be loaded.',
  );
});

test('FRASER theme header exposes an announced keyboard retry', async ({ page }) => {
  await expectReachableRetry(
    page,
    '/fraser/themes/1',
    '**/api/fraser/**',
    'Theme details could not be loaded.',
  );
});

test('FRASER timeline header exposes an announced keyboard retry', async ({ page }) => {
  await expectReachableRetry(
    page,
    '/fraser/timelines/1',
    '**/api/fraser/**',
    'Timeline details could not be loaded.',
  );
});
