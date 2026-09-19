import type {Page} from '@playwright/test';

export class IndicatorPage {
  constructor(private readonly page: Page) {}

  async goto(category: string, id: string): Promise<void> {
    await this.page.goto(`/indicators/${category}/${id}`);
  }

  async selectDataset(id: string): Promise<void> {
    await this.page.getByTestId(`dataset-${id}`).click();
  }
}
