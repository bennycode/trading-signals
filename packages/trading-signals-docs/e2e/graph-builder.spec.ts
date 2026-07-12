import {expect, test} from '@playwright/test';

import {GraphBuilderPage} from './pages/GraphBuilderPage';

test.describe('Strategy Builder', () => {
  test('loads the SMA crossover template as a valid, runnable graph', async ({page}) => {
    const builder = new GraphBuilderPage(page);
    await builder.goto();

    await expect(builder.validationBanner()).toContainText('Graph is valid');
    await expect(page.locator('.react-flow__node')).toHaveCount(10);
    expect(await builder.connectionCount()).toBe(10);
  });

  test('runs a backtest from the template and renders results', async ({page}) => {
    const builder = new GraphBuilderPage(page);
    await builder.goto();
    await builder.selectMarketCondition('Uptrend Shakeout (STX)');

    await builder.runBacktest();

    await expect(builder.results()).toContainText('Trade History');
    expect(Number(await builder.readResultMetric('Total Trades'))).toBeGreaterThan(0);
  });

  test('flags an incomplete graph instead of letting it run', async ({page}) => {
    const builder = new GraphBuilderPage(page);
    await builder.goto();
    await builder.clearCanvas();

    await builder.addNode('advice');

    await expect(builder.validationBanner()).toContainText('input port "when" is not connected');
    await expect(page.getByTestId('graph-run-backtest')).toBeDisabled();
  });

  test('a strategy built from scratch matches the template backtest', async ({page}) => {
    const builder = new GraphBuilderPage(page);
    await builder.goto();
    await builder.selectMarketCondition('Uptrend Shakeout (STX)');

    // Reference run: the prebuilt template.
    await builder.runBacktest();
    const templateTrades = await builder.readResultMetric('Total Trades');
    const templateRoi = await builder.readResultMetric('ROI');

    // Rebuild the same strategy by hand: palette clicks, config edits, and port drags.
    await builder.clearCanvas();
    const candles = await builder.addNode('source:candle');
    const fastBatcher = await builder.addNode('batcher');
    const slowBatcher = await builder.addNode('batcher');
    const fastClose = await builder.addNode('field');
    const slowClose = await builder.addNode('field');
    const fastSma = await builder.addNode('indicator');
    const slowSma = await builder.addNode('indicator');
    const crossover = await builder.addNode('if');
    const buy = await builder.addNode('advice');
    const sell = await builder.addNode('advice');
    await builder.fitView();

    await builder.configureNode(fastBatcher, 'timeframe', '1m');
    await builder.configureNode(slowBatcher, 'timeframe', '5m');
    await builder.configureNode(fastSma, 'period', '10');
    await builder.configureNode(slowSma, 'period', '20');
    await builder.configureNode(sell, 'side', 'SELL');
    await builder.configureNode(sell, 'amountIn', 'base');

    await builder.connect(candles, 'out', fastBatcher, 'in');
    await builder.connect(candles, 'out', slowBatcher, 'in');
    await builder.connect(fastBatcher, 'out', fastClose, 'in');
    await builder.connect(slowBatcher, 'out', slowClose, 'in');
    await builder.connect(fastClose, 'out', fastSma, 'in');
    await builder.connect(slowClose, 'out', slowSma, 'in');
    await builder.connect(fastSma, 'out', crossover, 'a');
    await builder.connect(slowSma, 'out', crossover, 'b');
    await builder.connect(crossover, 'true', buy, 'when');
    await builder.connect(crossover, 'false', sell, 'when');

    await expect(builder.validationBanner()).toContainText('Graph is valid');
    await builder.runBacktest();

    expect(await builder.readResultMetric('Total Trades')).toBe(templateTrades);
    expect(await builder.readResultMetric('ROI')).toBe(templateRoi);
  });

  test('deletes a node and its connections via the ✕ button', async ({page}) => {
    const builder = new GraphBuilderPage(page);
    await builder.goto();
    await builder.clearCanvas();
    const candles = await builder.addNode('source:candle');
    const field = await builder.addNode('field');
    await builder.connect(candles, 'out', field, 'in');
    expect(await builder.connectionCount()).toBe(1);

    await builder.deleteNode(candles);

    await expect(page.locator('.react-flow__node')).toHaveCount(1);
    expect(await builder.connectionCount()).toBe(0);
    await expect(builder.validationBanner()).toContainText('input port "in" is not connected');
  });

  test('refuses to connect mismatched port types', async ({page}) => {
    const builder = new GraphBuilderPage(page);
    await builder.goto();
    await builder.clearCanvas();

    const candles = await builder.addNode('source:candle');
    const indicator = await builder.addNode('indicator');

    // Candle output into a number input must not snap.
    await builder.connect(candles, 'out', indicator, 'in');

    expect(await builder.connectionCount()).toBe(0);
  });
});
