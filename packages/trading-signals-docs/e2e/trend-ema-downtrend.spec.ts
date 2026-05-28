import {expect, test} from '@playwright/test';

import {buildTrendPage} from './pages/trendPage';

test.describe('Trend indicators page', () => {
  test('selecting EMA on a synthetic downtrend reflects the choice in URL and UI', async ({page}) => {
    const trendPage = buildTrendPage(page);
    await trendPage.goto();

    await trendPage.selectIndicator('EMA');
    await trendPage.selectMarketCondition('Synthetic Downtrend');

    await expect(page).toHaveURL(/#ema$/);
    await expect(page.getByRole('combobox')).toHaveValue('downtrend');
    await expect(page.getByText('Falling market - prices trending downward (1d)')).toBeVisible();
  });
});
