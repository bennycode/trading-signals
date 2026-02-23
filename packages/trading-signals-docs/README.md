# Trading Signals Documentation Site

Interactive showcase website for the trading-signals library, featuring live examples, demos of all technical indicators, and a visual strategy backtester.

## Features

### Indicator Examples

Live interactive examples for every technical indicator in the `trading-signals` library, organized by category (trend, momentum, volatility, volume).

### Visual Backtester

A fully interactive backtester at `/backtest` that lets you simulate trading strategies on historical market data and compare them against a Buy & Hold baseline.

## Customization

- **Colors**: Edit `tailwind.config.js` to change the theme
- **Add indicators**: Follow the pattern in existing indicator pages
- **Modify layout**: Edit `pages/_app.tsx` for navigation/footer changes
- **Styling**: Customize `styles/globals.css`
- **Add datasets**: Import candle JSON files in `utils/datasets.ts`

## Development

The docs site uses the local `trading-signals` and `trading-strategies` packages from the monorepo. After making changes to either library, rebuild it with:

```bash
lerna run dist --scope trading-signals
# or
lerna run dist --scope trading-strategies
```

You can do this while the Next.js dev server is running. Just refresh the browser afterwards to see your changes.

## Adding New Indicators

1. Import the indicator from `trading-signals`
2. Create an `IndicatorExample` object
3. Add it to the appropriate category page

## Adding New Strategies to the Backtester

1. Add a Zod schema and export it from the strategy file in `trading-strategies`
2. Export the schema and strategy from `trading-strategies/src/index.ts`
3. Add a `StrategyDefinition` entry in `utils/strategySchemas.ts`
4. Add a `case` for the strategy in `createStrategy()` in `pages/backtest.tsx`
