# Trading Signals Documentation Site

Interactive showcase website for the trading-signals library, featuring live examples and demos of all technical indicators.

## Customization

- **Colors**: Edit `tailwind.config.js` to change the theme
- **Add indicators**: Follow the pattern in existing indicator pages
- **Modify layout**: Edit `pages/_app.tsx` for navigation/footer changes
- **Styling**: Customize `styles/globals.css`

## Adding New Indicators

1. Import the indicator from `trading-signals`
2. Create an `IndicatorExample` object with:
   - `name`: Display name
   - `description`: Brief explanation
   - `code`: Example code snippet
   - `inputValues`: Default values to demonstrate
   - `calculate`: Function that runs the indicator
3. Add it to the appropriate category page

Example:

```typescript
const example: IndicatorExample = {
  name: 'My Indicator',
  description: 'What it does',
  code: `import { MyIndicator } from 'trading-signals';
const indicator = new MyIndicator(14);
indicator.add(100);`,
  inputValues: [100, 101, 102],
  calculate: values => {
    const indicator = new MyIndicator(14);
    const allResults = [];

    for (const value of values) {
      indicator.add(value);
      allResults.push({
        value,
        result: indicator.isStable ? indicator.getResult().toFixed(2) : null,
      });
    }

    return {
      result: indicator.isStable ? indicator.getResult().toFixed(2) : null,
      allResults,
    };
  },
};
```
