# Docs Package

## Type Errors from Dependencies

This package consumes types from `@typedtrader/exchange` and `trading-strategies`. If you see type errors that reference stale types, rebuild the upstream packages first:

```bash
npm run build --workspace=packages/exchange
npm run build --workspace=packages/trading-strategies
```
