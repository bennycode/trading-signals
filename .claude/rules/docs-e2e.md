# Docs E2E (Playwright)

Playwright lives at `packages/trading-signals-docs/e2e/`. Vitest excludes that folder; the two suites do not overlap.

## Write E2E only for cross-cutting behavior

A spec earns an E2E slot only when the integration itself is the test — page navigation, hydration of client components, third-party widgets (Highcharts, etc.) actually rendering, or anything that needs a real browser to be meaningful. Anything that can be exercised with a mocked render belongs in the vitest unit suite under `__tests__/`.

## Page objects are factory functions

Match the codebase style — arrow functions, no `class`. Each page object exposes `goto()` plus verb actions; specs compose them so every `test` body reads arrange / act / assert in ~3 lines. When a body grows past ~6 lines, extract the next verb to the page object.

```ts
// e2e/pages/homePage.ts
export const buildHomePage = (page: Page): HomePage => ({
  goto: async () => page.goto('/'),
  openCategory: async category => { ... },
});
```

Page objects live under `e2e/pages/<name>Page.ts` and are named `build<Name>Page`.

## Run via `npm run test:e2e`

From `packages/trading-signals-docs/`:

```sh
npm run test:e2e        # headless
npx playwright test --ui # interactive runner
```

Playwright auto-starts `next dev` via the `webServer` config and reuses an existing dev server when one is already running locally. On CI the suite runs with 1 worker, 2 retries, JUnit reporter, and traces/screenshots on failure.

First-time setup on a fresh machine: `npx playwright install chromium`.

## Point at a deployed preview

Set `APP_URL` to override the base URL — useful for smoke-testing a preview deployment without spinning up the dev server:

```sh
APP_URL=https://preview.example.com npx playwright test
```
