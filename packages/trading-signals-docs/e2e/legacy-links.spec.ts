import {expect, test} from '@playwright/test';

test.describe('Links to the previous docs site', () => {
  test('forwards a category hash link to the indicator page', async ({page}) => {
    await page.goto('/indicators/trend/#ema');

    await expect(page, 'the old site addressed indicators by hash on the category page').toHaveURL(
      /\/indicators\/trend\/ema$/
    );
  });

  test('keeps the category page when the hash is not an indicator', async ({page}) => {
    await page.goto('/indicators/trend/#unknown');

    await expect(page.getByRole('heading', {level: 1, name: 'Trend Indicators'})).toBeVisible();
  });
});
