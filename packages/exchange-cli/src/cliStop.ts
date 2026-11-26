import Big from 'big.js';
import {ms} from 'ms';
import type {MarketDataSource, TradingPair} from '@typedtrader/exchange';
import {AtrPercent, atrMultipleToPercent, classifyAtrMultiple, type AtrRoomVerdict} from 'trading-strategies';

/** Daily bars, because an ATR stop is conventionally read off the same chart the position is held on. */
const TIMEFRAME = '1d';
const TRUE_RANGE_PERIOD = 14;
/** Enough daily bars for Wilder's smoothing to settle rather than the bare minimum to produce a number. */
const WARM_UP_BARS = 60;

export type StopPlacement = {
  /**
   * What the multiple was measured from. A multiple with no anchor named is not a number anyone can
   * check: the same stop reads as 1.8x below a spiked fill and 0.8x below where the stock trades.
   */
  anchor: 'fill';
  anchorPrice: string;
  atr: string;
  atrMultiple: string;
  /** ATR as a percent of price, so the stop distance can be compared across instruments. */
  atrPercent: string;
  /** How far below the anchor the stop sits, in percent. */
  distancePercent: string;
  /**
   * The same stop expressed as a multiple of the last daily close rather than of the fill. A fill
   * well above that close means the stop is nearer the market than the multiple suggests.
   */
  priorCloseMultiple: string;
  /** Whether the multiple leaves the stop inside the instrument's normal noise. */
  room: AtrRoomVerdict;
  stopPrice: string;
};

export type RestingStop = StopPlacement & {orderId: string};

function decimals(value: Big, places = 4): string {
  return value.round(places, Big.roundHalfUp).toString();
}

/** Reads the instrument's average range off its own daily bars. */
export async function readTrueRange(broker: Pick<MarketDataSource, 'getRecentCandles'>, pair: TradingPair) {
  const candles = await broker.getRecentCandles(pair, WARM_UP_BARS, ms(TIMEFRAME));
  const average = new AtrPercent(TRUE_RANGE_PERIOD);

  for (const candle of candles) {
    average.add({close: Number(candle.close), high: Number(candle.high), low: Number(candle.low)});
  }

  const atr = average.atr;
  const atrPercent = average.value;
  const priorClose = candles.at(-1)?.close;

  if (atr === null || atrPercent === null || priorClose === undefined) {
    throw new Error(
      `${pair.base} has no average range yet: ${candles.length} daily candles arrived, ${TRUE_RANGE_PERIOD} are needed. Buy with --no-stop, or place the stop by hand.`
    );
  }

  return {atr, atrPercent, priorClose};
}

/**
 * Places the protective stop a multiple of the average range below the price actually paid.
 *
 * Rounding goes down to the venue's tick, so the tick can only widen the gap and never tighten it,
 * and the multiple is kept with the anchor it was measured from. The stop is a fixed floor from the
 * entry rather than a trail: a trail ratchets up and eventually sells every position it protects.
 */
export function planStop(options: {
  anchorPrice: Big;
  atr: number;
  atrMultiple: string;
  atrPercent: number;
  increment: string;
  priorClose: string;
}): StopPlacement {
  const {anchorPrice, atr, atrMultiple, atrPercent, increment, priorClose} = options;
  const distance = new Big(atr).times(atrMultiple);
  const raw = anchorPrice.minus(distance);
  const tick = new Big(increment);
  const stopPrice = tick.gt(0) ? raw.div(tick).round(0, Big.roundDown).times(tick) : raw;

  if (stopPrice.lte(0)) {
    throw new Error(
      `A ${atrMultiple}x stop below a fill of ${anchorPrice.toString()} lands at or below zero. Use a smaller --stop-atr.`
    );
  }

  return {
    anchor: 'fill',
    anchorPrice: anchorPrice.toString(),
    atr: decimals(new Big(atr)),
    atrMultiple,
    atrPercent: decimals(new Big(atrPercent), 2),
    distancePercent: decimals(anchorPrice.minus(stopPrice).div(anchorPrice).times(100), 2),
    priorCloseMultiple: decimals(new Big(priorClose).minus(stopPrice).div(atr), 2),
    room: classifyAtrMultiple(Number(atrMultiple)),
    stopPrice: stopPrice.toString(),
  };
}

/** The percentage a given ATR multiple works out to, for a dry run that has no fill to anchor on. */
export function previewDistance(atrMultiple: string, atrPercent: number): string {
  return decimals(new Big(atrMultipleToPercent(Number(atrMultiple), atrPercent)), 2);
}
