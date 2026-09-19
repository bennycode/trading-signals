import {defineConfig, devices} from '@playwright/test';

const PORT = 4173;
const BASE_URL = process.env.APP_URL ?? `http://localhost:${PORT}`;
const WEB_SERVER_TIMEOUT_MS = 120_000;

export default defineConfig({
  forbidOnly: !!process.env.CI,
  fullyParallel: true,
  projects: [
    {
      name: 'chromium',
      use: {...devices['Desktop Chrome']},
    },
  ],
  reporter: process.env.CI
    ? [['junit', {outputFile: 'playwright-report.xml'}], ['list']]
    : [['html', {open: 'never'}], ['list']],
  retries: process.env.CI ? 2 : 0,
  testDir: './e2e',
  use: {
    baseURL: BASE_URL,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  /*
   * Serves the static build that gets deployed (run `npm run build` first) rather than the dev
   * server, so a page missing from the output fails here the same way it would on GitHub Pages.
   */
  webServer: {
    command: `npm run preview -- --port ${PORT}`,
    reuseExistingServer: !process.env.CI,
    stderr: 'pipe',
    stdout: 'pipe',
    timeout: WEB_SERVER_TIMEOUT_MS,
    url: BASE_URL,
  },
  workers: process.env.CI ? 1 : undefined,
});
