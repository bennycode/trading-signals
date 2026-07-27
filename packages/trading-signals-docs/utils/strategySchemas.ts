import type {z} from 'zod';
import type {Candle} from '@typedtrader/exchange';
import {
  BuyOnceSchema,
  BuyBelowSellAboveSchema,
  CoinFlipSchema,
  MultiIndicatorConfluenceSchema,
  ScalpSchema,
  MeanReversionSchema,
  SmaCrossoverSchema,
  ProtectedStrategySchema,
  TrailingStopSchema,
  suggestScalpOffset,
} from 'trading-strategies';

export {
  BuyOnceSchema,
  BuyBelowSellAboveSchema,
  CoinFlipSchema,
  MultiIndicatorConfluenceSchema,
  ScalpSchema,
  MeanReversionSchema,
  SmaCrossoverSchema,
  ProtectedStrategySchema,
  TrailingStopSchema,
};

export type StrategyId =
  | 'buy-and-hold'
  | 'buy-once'
  | 'buy-below-sell-above'
  | 'coin-flip'
  | 'multi-indicator-confluence'
  | 'scalp'
  | 'mean-reversion'
  | 'sma-crossover'
  | 'protection-only'
  | 'trailing-stop';

export interface StrategyDefinition {
  id: StrategyId;
  name: string;
  description: string;
  schema: z.ZodType;
  getDefaultConfig: (candles: Candle[]) => Record<string, unknown>;
}

function getPriceStats(candles: Candle[]): {firstClose: number; minClose: number; maxClose: number} {
  if (candles.length === 0) {
    return {firstClose: 100, maxClose: 110, minClose: 90};
  }
  const firstClose = parseFloat(candles[0].close);
  let minClose = firstClose;
  let maxClose = firstClose;

  for (let i = 1; i < candles.length; i++) {
    const close = parseFloat(candles[i].close);
    if (close < minClose) {
      minClose = close;
    }
    if (close > maxClose) {
      maxClose = close;
    }
  }

  return {firstClose, maxClose, minClose};
}

export const strategyDefinitions: StrategyDefinition[] = [
  {
    description: 'Buys once at the first candle and holds for the entire period. Simplest baseline strategy.',
    getDefaultConfig: () => ({}),
    id: 'buy-and-hold',
    name: 'Buy & Hold',
    schema: BuyOnceSchema,
  },
  {
    description:
      'Places a single limit buy when the close price drops to or below a predefined price. After the buy triggers, the strategy stays silent.',
    getDefaultConfig: candles => {
      const {firstClose, minClose} = getPriceStats(candles);
      const buyAt = (firstClose + minClose) / 2;
      return {buyAt: buyAt.toFixed(2)};
    },
    id: 'buy-once',
    name: 'Buy Once',
    schema: BuyOnceSchema,
  },
  {
    description:
      'Randomly buys or sells on every candle with 50/50 probability. Useful as a baseline to confirm any strategy beats pure chance.',
    getDefaultConfig: () => ({}),
    id: 'coin-flip',
    name: 'Coin Flip',
    schema: CoinFlipSchema,
  },
  {
    description:
      'Buys when the close price drops below a threshold and sells when it rises above another. Repeats on every qualifying candle.',
    getDefaultConfig: candles => {
      const {maxClose, minClose} = getPriceStats(candles);
      const range = maxClose - minClose;
      return {
        buyBelow: (minClose + range * 0.3).toFixed(2),
        sellAbove: (maxClose - range * 0.3).toFixed(2),
      };
    },
    id: 'buy-below-sell-above',
    name: 'Buy Below / Sell Above',
    schema: BuyBelowSellAboveSchema,
  },
  {
    description:
      'Combines EMA trend, MACD momentum, Bollinger Bands mean-reversion, and RSI filters. Buys on bullish confluence at the lower band; sells on bearish confluence at the upper band.',
    getDefaultConfig: () => ({
      bollingerDeviationMultiplier: 0.5,
      bollingerPeriod: 5,
      emaLongPeriod: 15,
      emaShortPeriod: 9,
      macdLongPeriod: 7,
      macdShortPeriod: 5,
      macdSignalPeriod: 9,
      rsiOverbought: 65,
      rsiOversold: 45,
      rsiPeriod: 14,
    }),
    id: 'multi-indicator-confluence',
    name: 'Multi-Indicator Confluence',
    schema: MultiIndicatorConfluenceSchema,
  },
  {
    description:
      'Waits for price to cross above EMA, then market buys. Sells at fill + offset, re-buys at fill - offset, and repeats. Offset can be auto-tuned from ATR.',
    getDefaultConfig: candles => {
      let offset = '0.10';

      try {
        offset = suggestScalpOffset(candles).toFixed(2);
      } catch {
        // Not enough candles for ATR — use fallback
      }

      return {emaPeriod: 5, offset};
    },
    id: 'scalp',
    name: 'Scalp',
    schema: ScalpSchema,
  },
  {
    description:
      'Batches 1-minute candles into 1-hour bars and applies Bollinger Bands (20, 2.5). Sells when price breaks above the upper band; rebuys when it returns to the middle band.',
    getDefaultConfig: () => ({}),
    id: 'mean-reversion',
    name: 'Mean Reversion',
    schema: MeanReversionSchema,
  },
  {
    description:
      'Crosses a fast SMA against a slow SMA — each with its own period and timeframe (e.g. SMA5 on 1m bars vs SMA10 on 2m bars). Buys when the fast SMA crosses above the slow one and sells when it crosses below (market orders).',
    getDefaultConfig: () => ({fastPeriod: 5, fastTimeframe: '1m', slowPeriod: 10, slowTimeframe: '2m'}),
    id: 'sma-crossover',
    name: 'SMA Crossover',
    schema: SmaCrossoverSchema,
  },
  {
    description:
      'Never opens a position. Use with seedFromBalance to attach stop-loss / take-profit guards to an existing position opened manually or by another strategy.',
    getDefaultConfig: () => ({
      protected: {
        seedFromBalance: true,
        stopLossPct: '5',
        takeProfitPct: '10',
      },
    }),
    id: 'protection-only',
    name: 'Protection Only',
    schema: ProtectedStrategySchema,
  },
  {
    description:
      'Exit-only trailing stop. Attaches to an existing base balance, tracks the highest candle high since attach, and emits a sell-all advice when the close drops by trailDownPct from the peak. Set initialBase > 0 in the backtest setup so the strategy has a position to protect.',
    getDefaultConfig: () => ({exitOrder: 'limit', trailDownPct: '10'}),
    id: 'trailing-stop',
    name: 'Trailing Stop',
    schema: TrailingStopSchema,
  },
];
