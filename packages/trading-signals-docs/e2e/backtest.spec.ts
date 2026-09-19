import {expect, test} from '@playwright/test';

import {BacktestPage} from './pages/BacktestPage';

test.describe('Backtest page', () => {
  test('runs a backtest in the browser and shows the baseline', async ({page}) => {
    const backtestPage = new BacktestPage(page);
    await backtestPage.goto();

    await backtestPage.run();

    await expect(page.getByRole('heading', {name: 'Selected Strategy'})).toBeVisible();
    await expect(page.getByRole('heading', {name: 'Buy & Hold Baseline'})).toBeVisible();
  });
});
