import {z} from 'zod';
import type {ExchangeCandle} from '@typedtrader/exchange';

const positiveNumberString = z
  .string()
  .regex(/^\d+(\.\d+)?$/, 'Must be a positive number')
  .refine(val => parseFloat(val) > 0, 'Must be greater than 0');

export const BuyAndHoldSchema = z.object({});

export const BuyOnceSchema = z.object({
  buyAt: positiveNumberString,
});

export const BuyBelowSellAboveSchema = z.object({
  buyBelow: positiveNumberString.optional(),
  sellAbove: positiveNumberString.optional(),
});

export type StrategyId = 'buy-and-hold' | 'buy-once' | 'buy-below-sell-above';

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
  const closes = candles.map(c => parseFloat(c.close));
  return {
    firstClose: closes[0],
    minClose: Math.min(...closes),
    maxClose: Math.max(...closes),
  };
}

export const strategyDefinitions: StrategyDefinition[] = [
  {
    id: 'buy-and-hold',
    name: 'Buy & Hold',
    description: 'Buys once at the first candle and holds for the entire period. Simplest baseline strategy.',
    schema: BuyAndHoldSchema,
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
];
