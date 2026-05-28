import type {Page} from '@playwright/test';

export class HomePage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/');
  }

  async openCategory(category: string): Promise<void> {
    await this.page.getByRole('link', {name: new RegExp(category)}).first().click();
  }
}
