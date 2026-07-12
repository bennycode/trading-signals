import type {Locator, Page} from '@playwright/test';

export class GraphBuilderPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/graph-builder');
    await this.page.getByTestId('graph-canvas').waitFor();
    // The canvas is client-only; nodes appear once React Flow has hydrated.
    await this.page.locator('.react-flow__node').first().waitFor();
  }

  async clearCanvas(): Promise<void> {
    await this.page.getByTestId('graph-clear').click();
  }

  async loadTemplate(): Promise<void> {
    await this.page.getByTestId('graph-load-template').click();
    await this.page.locator('.react-flow__node').first().waitFor();
  }

  /** Adds a node via the palette and returns its generated id. */
  async addNode(nodeType: string) {
    const before = await this.page.locator('.react-flow__node').count();
    await this.page.getByTestId(`palette-${nodeType}`).click();
    const node = this.page.locator('.react-flow__node').nth(before);
    await node.waitFor();
    const id = await node.getAttribute('data-id');
    if (!id) {
      throw new Error(`Added node of type "${nodeType}" has no data-id`);
    }
    return id;
  }

  async fitView(): Promise<void> {
    await this.page.locator('.react-flow__controls-fitview').click();
  }

  #handle(nodeId: string, port: string, kind: 'source' | 'target'): Locator {
    return this.page.locator(
      `.react-flow__node[data-id="${nodeId}"] .react-flow__handle.${kind}[data-handleid="${port}"]`
    );
  }

  /** Drags a connection from an output port to an input port, like a user would. */
  async connect(fromNode: string, fromPort: string, toNode: string, toPort: string): Promise<void> {
    await this.page.getByTestId('graph-canvas').scrollIntoViewIfNeeded();
    const source = this.#handle(fromNode, fromPort, 'source');
    const target = this.#handle(toNode, toPort, 'target');
    const sourceBox = (await source.boundingBox())!;
    const targetBox = (await target.boundingBox())!;
    await this.page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
    await this.page.mouse.down();
    await this.page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, {steps: 12});
    await this.page.mouse.up();
  }

  async deleteNode(nodeId: string): Promise<void> {
    await this.page.getByTestId(`node-${nodeId}-delete`).click();
  }

  async configureNode(nodeId: string, field: string, value: string): Promise<void> {
    const control = this.page.getByTestId(`node-${nodeId}-${field}`);
    const tagName = await control.evaluate(element => element.tagName);
    if (tagName === 'SELECT') {
      await control.selectOption(value);
    } else {
      await control.fill(value);
    }
  }

  async selectMarketCondition(label: string): Promise<void> {
    await this.page.getByTestId('market-condition-select').selectOption({label});
  }

  async runBacktest(): Promise<void> {
    await this.page.getByTestId('graph-run-backtest').click();
    await this.page.getByTestId('graph-backtest-results').waitFor();
  }

  validationBanner(): Locator {
    return this.page.getByTestId('graph-validation');
  }

  connectionCount() {
    return this.page.locator('.react-flow__edge').count();
  }

  results(): Locator {
    return this.page.getByTestId('graph-backtest-results');
  }

  /**
   * Reads a metric like "Total Trades" from the result cards. The selected strategy's
   * section renders before the baseline, so the first match is the strategy under test.
   */
  async readResultMetric(label: string) {
    const text = await this.results().innerText();
    const match = text.match(new RegExp(`${label}\\s*ⓘ?\\s*([^\\n]+)`));
    return match?.[1].trim() ?? '';
  }
}
