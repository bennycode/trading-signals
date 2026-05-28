import type {Page} from '@playwright/test';

type TrendPage = {
  goto: () => Promise<void>;
  selectIndicator: (id: string) => Promise<void>;
  selectMarketCondition: (label: string) => Promise<void>;
};

export const buildTrendPage = (page: Page): TrendPage => ({
  goto: async () => {
    await page.goto('/indicators/trend');
  },
  selectIndicator: async id => {
    await page.getByTestId(`indicator-${id}`).click();
  },
  selectMarketCondition: async label => {
    await page.getByTestId('market-condition-select').selectOption({label});
  },
});
