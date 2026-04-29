import {z} from 'zod';
import type {ExchangeCandle} from '@typedtrader/exchange';
import {BuyOnceSchema, BuyBelowSellAboveSchema, CoinFlipSchema, MultiIndicatorConfluenceSchema, ScalpSchema, MeanReversionSchema, ProtectedStrategySchema, TrailingStopSchema, suggestScalpOffset} from 'trading-strategies';

export {BuyOnceSchema, BuyBelowSellAboveSchema, CoinFlipSchema, MultiIndicatorConfluenceSchema, ScalpSchema, MeanReversionSchema, ProtectedStrategySchema, TrailingStopSchema};

export type StrategyId = 'buy-and-hold' | 'buy-once' | 'buy-below-sell-above' | 'coin-flip' | 'multi-indicator-confluence' | 'scalp' | 'mean-reversion' | 'protection-only' | 'trailing-stop';

export interface StrategyDefinition {
  id: StrategyId;
  name: string;
  description: string;
  schema: z.ZodType;
  getDefaultConfig: (candles: ExchangeCandle[]) => Record<string, unknown>;
}

function getPriceStats(candles: ExchangeCandle[]): {firstClose: number; minClose: number; maxClose: number} {
  if (candles.length === 0) {
    return {firstClose: 100, minClose: 90, maxClose: 110};
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

  return {firstClose, minClose, maxClose};
}

export const strategyDefinitions: StrategyDefinition[] = [
  {
    id: 'buy-and-hold',
    name: 'Buy & Hold',
    description: 'Buys once at the first candle and holds for the entire period. Simplest baseline strategy.',
    schema: BuyOnceSchema,
    getDefaultConfig: () => ({}),
  },
  {
    id: 'buy-once',
    name: 'Buy Once',
    description:
      'Places a single limit buy when the close price drops to or below a predefined price. After the buy triggers, the strategy stays silent.',
    schema: BuyOnceSchema,
    getDefaultConfig: candles => {
      const {firstClose, minClose} = getPriceStats(candles);
      const buyAt = (firstClose + minClose) / 2;
      return {buyAt: buyAt.toFixed(2)};
    },
  },
  {
    id: 'coin-flip',
    name: 'Coin Flip',
    description: 'Randomly buys or sells on every candle with 50/50 probability. Useful as a baseline to confirm any strategy beats pure chance.',
    schema: CoinFlipSchema,
    getDefaultConfig: () => ({}),
  },
  {
    id: 'buy-below-sell-above',
    name: 'Buy Below / Sell Above',
    description:
      'Buys when the close price drops below a threshold and sells when it rises above another. Repeats on every qualifying candle.',
    schema: BuyBelowSellAboveSchema,
    getDefaultConfig: candles => {
      const {minClose, maxClose} = getPriceStats(candles);
      const range = maxClose - minClose;
      return {
        buyBelow: (minClose + range * 0.3).toFixed(2),
        sellAbove: (maxClose - range * 0.3).toFixed(2),
      };
    },
  },
  {
    id: 'multi-indicator-confluence',
    name: 'Multi-Indicator Confluence',
    description:
      'Combines EMA trend, MACD momentum, Bollinger Bands mean-reversion, and RSI filters. Buys on bullish confluence at the lower band; sells on bearish confluence at the upper band.',
    schema: MultiIndicatorConfluenceSchema,
    getDefaultConfig: () => ({
      emaShortPeriod: 9,
      emaLongPeriod: 15,
      macdShortPeriod: 5,
      macdLongPeriod: 7,
      macdSignalPeriod: 9,
      bollingerPeriod: 5,
      bollingerDeviationMultiplier: 0.5,
      rsiPeriod: 14,
      rsiOverbought: 65,
      rsiOversold: 45,
    }),
  },
  {
    id: 'scalp',
    name: 'Scalp',
    description:
      'Waits for price to cross above EMA, then market buys. Sells at fill + offset, re-buys at fill - offset, and repeats. Offset can be auto-tuned from ATR.',
    schema: ScalpSchema,
    getDefaultConfig: candles => {
      let offset = '0.10';

      try {
        offset = suggestScalpOffset(candles).toFixed(2);
      } catch {
        // Not enough candles for ATR — use fallback
      }

      return {offset, emaPeriod: 5};
    },
  },
  {
    id: 'mean-reversion',
    name: 'Mean Reversion',
    description:
      'Batches 1-minute candles into 1-hour bars and applies Bollinger Bands (20, 2.5). Sells when price breaks above the upper band; rebuys when it returns to the middle band.',
    schema: MeanReversionSchema,
    getDefaultConfig: () => ({}),
  },
  {
    id: 'protection-only',
    name: 'Protection Only',
    description:
      'Never opens a position. Use with seedFromBalance to attach stop-loss / take-profit guards to an existing position opened manually or by another strategy.',
    schema: ProtectedStrategySchema,
    getDefaultConfig: () => ({
      protected: {
        stopLossPct: '5',
        takeProfitPct: '10',
        seedFromBalance: true,
      },
    }),
  },
  {
    id: 'trailing-stop',
    name: 'Trailing Stop',
    description:
      'Exit-only trailing stop. Attaches to an existing base balance, tracks the highest candle high since attach, and emits a sell-all advice when the close drops by trailDownPct from the peak. Set initialBase > 0 in the backtest setup so the strategy has a position to protect.',
    schema: TrailingStopSchema,
    getDefaultConfig: () => ({trailDownPct: '10', exitOrder: 'limit'}),
  },
];
