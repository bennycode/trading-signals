import type {z} from 'zod';
import {BuyOnceStrategy, BuyOnceSchema} from '../strategy-buy-once/BuyOnceStrategy.js';
import {BuyBelowSellAboveStrategy, BuyBelowSellAboveSchema} from '../strategy-buy-below-sell-above/BuyBelowSellAboveStrategy.js';
import {CoinFlipStrategy, CoinFlipSchema} from '../strategy-coin-flip/CoinFlipStrategy.js';
import {
  MultiIndicatorConfluenceStrategy,
  MultiIndicatorConfluenceSchema,
} from '../strategy-multi-indicator-confluence/MultiIndicatorConfluenceStrategy.js';
import {MeanReversionStrategy, MeanReversionSchema} from '../strategy-mean-reversion/MeanReversionStrategy.js';
import {ScalpStrategy, ScalpSchema} from '../strategy-scalp/ScalpStrategy.js';
import {ProtectedStrategy, ProtectedStrategySchema} from '../strategy-protected/ProtectedStrategy.js';
import type {Strategy} from './Strategy.js';

interface StrategyEntry {
  create: (config: unknown) => Strategy;
  schema: z.ZodType;
}

const registry: Record<string, StrategyEntry> = {
  [BuyOnceStrategy.NAME]: {
    create: (config: unknown) => new BuyOnceStrategy(BuyOnceSchema.parse(config ?? {})),
    schema: BuyOnceSchema,
  },
  [BuyBelowSellAboveStrategy.NAME]: {
    create: (config: unknown) => new BuyBelowSellAboveStrategy(BuyBelowSellAboveSchema.parse(config)),
    schema: BuyBelowSellAboveSchema,
  },
  [CoinFlipStrategy.NAME]: {
    create: (config: unknown) => new CoinFlipStrategy(CoinFlipSchema.parse(config ?? {})),
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
  [MeanReversionStrategy.NAME]: {
    create: (config: unknown) => new MeanReversionStrategy({config: MeanReversionSchema.parse(config ?? {})}),
    schema: MeanReversionSchema,
  },
  [ProtectedStrategy.NAME]: {
    create: (config: unknown) => new ProtectedStrategy({config: ProtectedStrategySchema.parse(config ?? {})}),
    schema: ProtectedStrategySchema,
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
