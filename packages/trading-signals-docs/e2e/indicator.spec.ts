import {expect, test} from '@playwright/test';

import {IndicatorPage} from './pages/IndicatorPage';

test.describe('Indicator page', () => {
  test('switching the market regime updates the hydrated demo', async ({page}) => {
    const indicatorPage = new IndicatorPage(page);
    await indicatorPage.goto('trend', 'ema');

    await indicatorPage.selectDataset('downtrend');

    await expect(page.getByText('Falling market - prices trending downward (1d)')).toBeVisible();
    await expect(page.locator('.highcharts-root').first(), 'Highcharts renders the indicator chart').toBeVisible();
  });
});
