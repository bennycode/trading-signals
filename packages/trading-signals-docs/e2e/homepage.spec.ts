import {expect, test} from '@playwright/test';

import {HomePage} from './pages/HomePage';

test.describe('Homepage', () => {
  test('renders the introduction and the indicator categories', async ({page}) => {
    const homePage = new HomePage(page);
    await homePage.goto();

    await expect(page.getByRole('heading', {level: 1, name: 'Typed Trader'})).toBeVisible();
    await expect(page.getByRole('link', {exact: true, name: 'trading-signals'})).toHaveAttribute(
      'href',
      'https://www.npmjs.com/package/trading-signals'
    );
    for (const category of ['Trend Indicators', 'Momentum Indicators', 'Volatility Indicators', 'Volume Indicators']) {
      await expect(page.getByRole('navigation').getByRole('button', {name: category})).toBeVisible();
    }
  });

  test('navigates from the sidebar to an indicator page', async ({page}) => {
    const homePage = new HomePage(page);
    await homePage.goto();

    await homePage.openIndicator('Trend Indicators', 'EMA');

    await expect(page).toHaveURL(/\/indicators\/trend\/ema$/);
    await expect(page.getByRole('heading', {level: 1})).toContainText('EMA');
  });
});
