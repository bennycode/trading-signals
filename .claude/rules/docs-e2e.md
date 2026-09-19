---
paths:
  - 'packages/trading-signals-docs/e2e/**/*'
---

# Docs E2E (Playwright)

Playwright lives at `packages/trading-signals-docs/e2e/`. The docs package has no unit test runner; `npm test` there only typechecks.

## Write E2E only for cross-cutting behavior

A spec earns an E2E slot only when the integration itself is the test — page navigation, hydration of client components, third-party widgets (Highcharts, etc.) actually rendering, or anything that needs a real browser to be meaningful. Logic that can be tested without a browser belongs in a unit test in the package that owns it (e.g. `trading-signals` or `trading-strategies`).

## Page objects are classes

Use the classic class-based [Page Object Model](https://playwright.dev/docs/pom) — one class per page, `page` held as a private readonly field, public async methods for verb actions. Each page object exposes `goto()` plus verb actions; specs compose them so every `test` body reads arrange / act / assert in ~3 lines. When a body grows past ~6 lines, extract the next verb to the page object.

```ts
// e2e/pages/HomePage.ts
export class HomePage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/');
  }

  async openCategory(category: string): Promise<void> { ... }
}
```

Page objects live under `e2e/pages/<Name>Page.ts` (PascalCase filename to match the exported class) and the class is named `<Name>Page`. Specs instantiate with `new <Name>Page(page)`.

## Run via `npm run test:e2e`

From `packages/trading-signals-docs/`:

```sh
npm run test:e2e        # headless
npx playwright test --ui # interactive runner
```

Playwright serves the static build with `vocs preview` via the `webServer` config (so run `npm run build` first) and reuses a server that is already running locally. Testing the build rather than the dev server means a page missing from the output fails here the same way it would on GitHub Pages. On CI the suite runs with 1 worker, 2 retries, JUnit reporter, and traces/screenshots on failure.

First-time setup on a fresh machine: `npx playwright install chromium`.

## Point at a deployed preview

Set `APP_URL` to override the base URL — useful for smoke-testing a preview deployment without spinning up the dev server:

```sh
APP_URL=https://preview.example.com npx playwright test
```
