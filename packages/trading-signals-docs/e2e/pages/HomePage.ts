import type {Page} from '@playwright/test';

export class HomePage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/');
  }

  async openIndicator(category: string, name: string): Promise<void> {
    const sidebar = this.page.getByRole('navigation');
    await sidebar.getByRole('button', {name: category}).click();
    await sidebar.getByRole('link', {exact: true, name}).click();
  }
}
