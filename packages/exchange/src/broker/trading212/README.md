# Trading212

13,000+ UK, European and US stocks and ETFs, commission-free. Trading212's API has no historical bars and no WebSocket, so this broker needs an external market-data source. For US equities Alpaca's feed is the natural choice: free, works with a paper account, and streams minute bars over WebSocket.

```ts
import {AlpacaMarketData, getTrading212Client, TradingPair} from '@typedtrader/exchange';

// 1. Construct an Alpaca-backed market-data source.
const marketData = new AlpacaMarketData({
  apiKey: 'ALPACA_API_KEY',
  apiSecret: 'ALPACA_API_SECRET',
  usePaperTrading: false, // read-only; doesn't place orders
});

// 2. Wire it into the Trading212 broker.
const broker = getTrading212Client({
  apiKey: 'TRADING212_API_KEY',
  apiSecret: 'TRADING212_API_SECRET',
  usePaperTrading: true,
  marketData, // required: Trading212 has no candles of its own
});

// 3. Use the broker as if it provided everything natively. Symbol mapping is automatic:
// Trading212's `AAPL_US_EQ` is stripped to Alpaca's `AAPL` behind the scenes.
const pair = new TradingPair('AAPL_US_EQ', 'USD');
const latest = await broker.getLatestCandle(pair, 60_000); // → from Alpaca's WebSocket
await broker.placeLimitOrder(pair, {side: 'BUY', size: '1', price: latest.close}); // → Trading212
```

Create your key at [Trading212 API keys](https://helpcentre.trading212.com/hc/en-us/articles/14584770928157-Trading-212-API-key).

## Why Trading212

- **Commission-free** investing in 13,000+ stocks and ETFs, with fractional shares from £1/€1.
- **Broad UK, European, and US coverage.**
- **Multi-currency accounts** for depositing and investing in 13 currencies.
- **Tax-advantaged Stocks & Shares ISA** (and Cash ISA) for UK residents, with no account fees.
- **Daily [interest](https://www.trading212.com/interest-on-cash)** paid on uninvested cash.

## Good to know

- **Cross-currency fees.** Trading212 debits a currency-conversion fee on cross-currency trades (e.g. a EUR account buying USD instruments) at ~0.15% per leg. `getFeeRates()` surfaces this as `CURRENCY_CONVERSION_FEE`; `estimateFee()` includes it in the total.
- **Order updates are polled.** Trading212 has no order-stream WebSocket, so `watchOrders` polls once per minute (matching Trading212's documented rate limit). Fills arrive within ~60 seconds rather than push-style.

## Resources

[API Documentation](https://docs.trading212.com/api) · [Fees](https://helpcentre.trading212.com/hc/en-us/articles/11471996799517)
