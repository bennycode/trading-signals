# Alpaca

US stocks, ETFs and crypto, with free market data and free paper trading.

```ts
import {getAlpacaClient, TradingPair} from '@typedtrader/exchange';

const broker = getAlpacaClient({
  apiKey: 'ALPACA_API_KEY',
  apiSecret: 'ALPACA_API_SECRET',
  usePaperTrading: true,
});

await broker.verifyCredentials();

const pair = new TradingPair('AAPL', 'USD');
const latest = await broker.getLatestCandle(pair, 60_000);
await broker.placeLimitOrder(pair, {side: 'BUY', size: '1', price: latest.close});
```

Create your keys at [Alpaca API keys](https://docs.alpaca.markets/us/docs/getting-started).

## Why Alpaca

- **Commission-free** US stocks and ETFs, with fractional shares.
- **Free paper trading** that mirrors the live API, so strategies can be validated without risking capital.
- **Free market data** via the IEX feed, including WebSocket-streamed minute bars (the source this package pairs with other brokers).
- **Crypto** trades 24/7 alongside equities.
- **[24/5 trading](https://docs.alpaca.markets/us/docs/245-trading)** of US stocks via an overnight session, so positions can be opened or closed from Sunday evening through Friday evening.
- **Add funds commission-free** with [Revolut](https://www.revolut.com/), avoiding the transfer fees most banks charge.

## Shorting needs enabling first

A new account is a cash account, and a cash account cannot sell short at any balance — a `SELL` without a position is rejected with `403 {"code":40310000,"message":"account is not allowed to short"}`. Switch it on under [Account Configuration](https://app.alpaca.markets/account/configuration), for the paper account as well as the live one. Alpaca also requires USD 2,000 or more in account equity to trade on margin or sell short.

Check it before a strategy relies on it, because the account reports both facts:

```ts
import {AlpacaAPI} from '@typedtrader/exchange';

const api = new AlpacaAPI({apiKey: 'ALPACA_API_KEY', apiSecret: 'ALPACA_API_SECRET', usePaperTrading: true});
const account = await api.getAccount();
// shorting_enabled: true, multiplier: '4' — a cash account answers false and '1'.
```

`multiplier` is the clearer signal: `1` is a cash account, while `2` or `4` means margin. Equity alone says nothing, since the limit is the account type rather than the balance.

## Resources

[API Reference](https://docs.alpaca.markets/reference/) · [OpenAPI Files](https://docs.alpaca.markets/openapi) · [24/5 Trading](https://docs.alpaca.markets/us/docs/245-trading) · [Account Configuration](https://app.alpaca.markets/account/configuration)
