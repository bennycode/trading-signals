import type {Page} from '@playwright/test';

export class BacktestPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/backtest');
  }

  async run(): Promise<void> {
    await this.page.getByRole('button', {name: 'Run Backtest'}).click();
  }
}
