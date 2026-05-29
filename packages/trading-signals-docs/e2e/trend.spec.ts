import {expect, test} from '@playwright/test';

import {TrendPage} from './pages/TrendPage';

test.describe('Trend indicators page', () => {
  test('selecting EMA on a synthetic downtrend reflects the choice in URL and UI', async ({page}) => {
    const trendPage = new TrendPage(page);
    await trendPage.goto();

    await trendPage.selectIndicator('ema');
    await trendPage.selectMarketCondition('Synthetic Downtrend');

    await expect(page).toHaveURL(/#ema$/);
    await expect(page.getByTestId('market-condition-select')).toHaveValue('downtrend');
    await expect(page.getByText('Falling market - prices trending downward (1d)')).toBeVisible();
  });
});
