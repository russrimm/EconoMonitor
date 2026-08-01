import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/a11y',
  fullyParallel: true,
  reporter: 'line',
  use: {
    baseURL: 'http://127.0.0.1:3104',
    browserName: 'chromium',
  },
  webServer: {
    command: 'npm run dev -- --hostname 127.0.0.1 --port 3104',
    url: 'http://127.0.0.1:3104',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
