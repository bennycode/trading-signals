import Big from 'big.js';
import {AtrPercent, classifyAtrMultiple, percentTrailStop, sizeFromRisk} from 'trading-strategies';
import type {Broker, MarketDataSource, TradingPair} from '@typedtrader/exchange';

export interface RiskOptions {
  /** ATR lookback in candles. */
  atrInterval: number;
  /** Candle size the ATR is measured on, in milliseconds. */
  atrIntervalMillis: number;
  /** How many ATR the stop sits below the entry. */
  atrMultiple: number;
  /** Account value the risk budget is a share of. Defaults to the counter-currency balance. */
  accountValue?: string;
  /** Share of the account to lose if the stop is hit, in percent. */
  riskPct: string;
}

/**
 * What you are taking on by buying this, before you buy it. Every line is a measurement of what
 * the instrument has recently done plus arithmetic on your own account — none of it is a forecast,
 * and nothing here says whether the position is a good idea.
 */
export async function assessRisk(
  broker: Pick<Broker, 'listBalances' | 'getSmallestInterval'> & Pick<MarketDataSource, 'getRecentCandles'>,
  pair: TradingPair,
  options: RiskOptions
) {
  const {accountValue, atrInterval, atrIntervalMillis, atrMultiple, riskPct} = options;
  // ATR(n) needs 2n-1 candles to stabilize; a small buffer beyond that keeps the reading steady.
  const candles = await broker.getRecentCandles(pair, atrInterval * 2 + 1, atrIntervalMillis);
  const atrPercent = new AtrPercent(atrInterval);

  for (const candle of candles) {
    atrPercent.add({close: parseFloat(candle.close), high: parseFloat(candle.high), low: parseFloat(candle.low)});
  }

  const atrPct = atrPercent.value;

  if (atrPct === null) {
    throw new Error(
      `Not enough history to measure volatility for "${pair.base}": got ${candles.length} candles, ATR(${atrInterval}) needs ${atrInterval * 2 - 1}.`
    );
  }

  const price = new Big(candles[candles.length - 1].close);
  const distancePct = new Big(atrPct).mul(atrMultiple);
  const stopPrice = percentTrailStop(price, distancePct);

  const balances = await broker.listBalances();
  const owned = balances.find(balance => balance.currency === pair.base)?.available ?? '0';
  const counterBalance = balances.find(balance => balance.currency === pair.counter)?.available;
  const account = accountValue ?? counterBalance;

  if (account === undefined) {
    throw new Error(`No ${pair.counter} balance to size against. Pass --account <value>.`);
  }

  const quantity = sizeFromRisk({accountValue: account, entryPrice: price, riskPct, stopPrice});
  const positionValue = quantity.mul(price);

  return {
    atr: {
      interval: atrInterval,
      percentOfPrice: new Big(atrPct).toFixed(2),
      value: new Big(atrPercent.atr ?? 0).toFixed(2),
    },
    holding: {
      otherPositions: balances
        .filter(balance => balance.currency !== pair.base && balance.currency !== pair.counter)
        .map(balance => balance.currency),
      owned,
    },
    price: price.toFixed(),
    size: {
      accountValue: new Big(account).toFixed(2),
      accountValueSource: accountValue === undefined ? `${pair.counter} balance` : 'provided',
      lossAtStop: new Big(account).mul(new Big(riskPct).div(100)).toFixed(2),
      positionValue: positionValue.toFixed(2),
      quantity: quantity.toFixed(4),
      shareOfAccount: positionValue.div(account).mul(100).toFixed(2),
    },
    stop: {
      band: classifyAtrMultiple(atrMultiple),
      distancePercent: distancePct.toFixed(2),
      multiple: atrMultiple,
      price: stopPrice.toFixed(2),
    },
    ticker: pair.base,
  };
}
