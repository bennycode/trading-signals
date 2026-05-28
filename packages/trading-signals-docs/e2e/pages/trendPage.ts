import type {Page} from '@playwright/test';

type TrendPage = {
  goto: () => Promise<void>;
  selectIndicator: (name: string) => Promise<void>;
  selectMarketCondition: (label: string) => Promise<void>;
};

export const buildTrendPage = (page: Page): TrendPage => ({
  goto: async () => {
    await page.goto('/indicators/trend');
  },
  selectIndicator: async name => {
    // Indicator buttons contain a name + description, so match the name at the
    // start of the accessible name to avoid false positives (e.g. DEMA → EMA).
    await page.getByRole('button', {name: new RegExp(`^${name}\\b`)}).click();
  },
  selectMarketCondition: async label => {
    await page.getByRole('combobox').selectOption({label});
  },
});
