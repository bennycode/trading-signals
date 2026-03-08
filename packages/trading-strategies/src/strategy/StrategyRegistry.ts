import type {z} from 'zod';
import {BuyAndHoldStrategy, BuyAndHoldSchema} from '../strategy-buy-and-hold/BuyAndHoldStrategy.js';
import {BuyOnceStrategy, BuyOnceSchema} from '../strategy-buy-once/BuyOnceStrategy.js';
import {BuyBelowSellAboveStrategy, BuyBelowSellAboveSchema} from '../strategy-buy-below-sell-above/BuyBelowSellAboveStrategy.js';
import {CoinFlipStrategy, CoinFlipSchema} from '../strategy-coin-flip/CoinFlipStrategy.js';
import {
  MultiIndicatorConfluenceStrategy,
  MultiIndicatorConfluenceSchema,
} from '../strategy-multi-indicator-confluence/MultiIndicatorConfluenceStrategy.js';
import {ScalpStrategy, ScalpSchema} from '../strategy-scalp/ScalpStrategy.js';
import type {Strategy} from './Strategy.js';

interface StrategyEntry {
  create: (config: any) => Strategy;
  schema: z.ZodType;
}

const registry: Record<string, StrategyEntry> = {
  [BuyAndHoldStrategy.NAME]: {
    create: () => new BuyAndHoldStrategy(),
    schema: BuyAndHoldSchema,
  },
  [BuyOnceStrategy.NAME]: {
    create: (config: unknown) => new BuyOnceStrategy(BuyOnceSchema.parse(config)),
    schema: BuyOnceSchema,
  },
  [BuyBelowSellAboveStrategy.NAME]: {
    create: (config: unknown) => new BuyBelowSellAboveStrategy(BuyBelowSellAboveSchema.parse(config)),
    schema: BuyBelowSellAboveSchema,
  },
  [CoinFlipStrategy.NAME]: {
    create: () => new CoinFlipStrategy(),
    schema: CoinFlipSchema,
  },
  [MultiIndicatorConfluenceStrategy.NAME]: {
    create: (config: unknown) =>
      new MultiIndicatorConfluenceStrategy(MultiIndicatorConfluenceSchema.parse(config)),
    schema: MultiIndicatorConfluenceSchema,
  },
  [ScalpStrategy.NAME]: {
    create: (config: unknown) => new ScalpStrategy(ScalpSchema.parse(config)),
    schema: ScalpSchema,
  },
};

export function createStrategy(name: string, config: unknown): Strategy {
  const entry = registry[name];
  if (!entry) {
    throw new Error(`Unknown strategy "${name}". Available: ${getStrategyNames().join(', ')}`);
  }
  return entry.create(config);
}

export function getStrategyNames(): string[] {
  return Object.keys(registry);
}
