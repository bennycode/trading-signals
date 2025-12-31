import {ms, CurrencyPair, getAlpacaClient} from '@typedtrader/exchange';

// Request Example: "SHOP,USD 1h"
export default async (request: string) => {
  if (!process.env.ALPACA_LIVE_API_KEY) {
    return;
  }

  if (!process.env.ALPACA_LIVE_API_SECRET) {
    return;
  }

  const spaceIndex = request.indexOf(' ');
  const pairPart = request.slice(0, spaceIndex);
  const commaIndex = pairPart.indexOf(',');
  const base = pairPart.slice(0, commaIndex);
  const counter = pairPart.slice(commaIndex + 1);
  const pair = new CurrencyPair(base, counter);
  const interval = request.slice(spaceIndex + 1);
  const intervalInMillis = ms(interval);

  const client = getAlpacaClient({
    apiKey: process.env.ALPACA_LIVE_API_KEY,
    apiSecret: process.env.ALPACA_LIVE_API_SECRET,
    usePaperTrading: false,
  });

  const candle = await client.getLatestAvailableCandle(pair, intervalInMillis);

  return JSON.stringify(candle);
};
