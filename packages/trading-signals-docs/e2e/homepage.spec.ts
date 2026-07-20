import {expect, test} from '@playwright/test';

import {HomePage} from './pages/HomePage';

test.describe('Homepage', () => {
  test('renders the hero, category navigation, and external links', async ({page}) => {
    const homePage = new HomePage(page);
    await homePage.goto();

    await expect(page.getByRole('heading', {level: 1, name: 'Trading Signals'})).toBeVisible();

    await expect(page.getByRole('link', {name: 'View on NPM'})).toHaveAttribute(
      'href',
      'https://www.npmjs.com/package/trading-signals'
    );
    await expect(page.getByRole('link', {name: 'View on GitHub'})).toHaveAttribute(
      'href',
      'https://github.com/bennycode/trading-signals'
    );

    await expect(page.getByRole('heading', {level: 2, name: 'Indicator Categories'})).toBeVisible();

    for (const category of ['Trend Indicators', 'Momentum Indicators', 'Volatility Indicators']) {
      await expect(page.getByText(category, {exact: true})).toBeVisible();
    }
  });

  test('navigates from the homepage to the trend indicators page', async ({page}) => {
    const homePage = new HomePage(page);
    await homePage.goto();

    await homePage.openCategory('Trend Indicators');

    await expect(page).toHaveURL(/\/indicators\/trend\/?$/);
  });
});
