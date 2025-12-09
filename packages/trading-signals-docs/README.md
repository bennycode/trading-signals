# Trading Signals Documentation Site

Interactive showcase website for the trading-signals library, featuring live examples and demos of all technical indicators.

## Customization

- **Colors**: Edit `tailwind.config.js` to change the theme
- **Add indicators**: Follow the pattern in existing indicator pages
- **Modify layout**: Edit `pages/_app.tsx` for navigation/footer changes
- **Styling**: Customize `styles/globals.css`

## Using `trading-signals`

The docs site uses the local `trading-signals` package from the monorepo. After making changes to the library, rebuild it with `lerna run dist --scope trading-signals` (or `npm run dist` from the `trading-signals` package directory). You can do this while the Next.js dev server is running. Just refresh the browser afterwards to see your changes in the docs.

## Adding New Indicators

1. Import the indicator from `trading-signals`
2. Create an `IndicatorExample` object
3. Add it to the appropriate category page
