import type {Page} from '@playwright/test';

type HomePage = {
  goto: () => Promise<void>;
  openCategory: (category: string) => Promise<void>;
};

export const buildHomePage = (page: Page): HomePage => ({
  goto: async () => {
    await page.goto('/');
  },
  openCategory: async category => {
    await page.getByRole('link', {name: new RegExp(category)}).first().click();
  },
});
