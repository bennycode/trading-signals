import type {Page} from '@playwright/test';

export class TrendPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/indicators/trend');
  }

  async selectIndicator(id: string): Promise<void> {
    await this.page.getByTestId(`indicator-${id}`).click();
  }

  async selectMarketCondition(label: string): Promise<void> {
    await this.page.getByTestId('market-condition-select').selectOption({label});
  }
}
