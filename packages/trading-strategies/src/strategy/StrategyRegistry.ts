import type {z} from 'zod';
import {BuyBelowSellAbove} from '../strategy-buy-below-sell-above/buyBelowSellAbove.js';
import {BuyOnce} from '../strategy-buy-once/buyOnce.js';
import {CoinFlip} from '../strategy-coin-flip/coinFlip.js';
import {MeanReversion} from '../strategy-mean-reversion/meanReversion.js';
import {MultiIndicatorConfluence} from '../strategy-multi-indicator-confluence/multiIndicatorConfluence.js';
import {NoopStrategy, NoopSchema} from '../strategy-noop/NoopStrategy.js';
import {Protected} from '../strategy-protected/protected.js';
import {Scalp} from '../strategy-scalp/scalp.js';
import {SmaCrossover} from '../strategy-sma-crossover/smaCrossover.js';
import {TrailingStop} from '../strategy-trailing-stop/trailingStop.js';
import type {Strategy} from './Strategy.js';

interface StrategyEntry {
  create: (config: unknown) => Strategy;
  schema: z.ZodType;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Lifts the kill-switch settings of a stored config out of the `protected` key they used to be
 * nested under. A stored config outlives the code that wrote it, and these are now settings of
 * the strategy itself, so both shapes are read and a flat setting wins over a nested one.
 */
function unnestProtection(config: unknown): unknown {
  if (!isRecord(config) || !isRecord(config.protected)) {
    return config;
  }
  const {protected: nested, ...flat} = config;
  return {...nested, ...flat};
}

const registry: Record<string, StrategyEntry> = {
  [BuyBelowSellAbove.NAME]: {
    create: (config: unknown) => new BuyBelowSellAbove(BuyBelowSellAbove.schema.parse(unnestProtection(config))),
    schema: BuyBelowSellAbove.schema,
  },
  [BuyOnce.NAME]: {
    create: (config: unknown) => new BuyOnce(BuyOnce.schema.parse(unnestProtection(config) ?? {})),
    schema: BuyOnce.schema,
  },
  [CoinFlip.NAME]: {
    create: (config: unknown) => new CoinFlip(CoinFlip.schema.parse(unnestProtection(config) ?? {})),
    schema: CoinFlip.schema,
  },
  [MeanReversion.NAME]: {
    create: (config: unknown) => new MeanReversion(MeanReversion.schema.parse(unnestProtection(config) ?? {})),
    schema: MeanReversion.schema,
  },
  [MultiIndicatorConfluence.NAME]: {
    create: (config: unknown) =>
      new MultiIndicatorConfluence(MultiIndicatorConfluence.schema.parse(unnestProtection(config))),
    schema: MultiIndicatorConfluence.schema,
  },
  [NoopStrategy.NAME]: {
    create: (config: unknown) => new NoopStrategy(NoopSchema.parse(config ?? {})),
    schema: NoopSchema,
  },
  [Protected.NAME]: {
    create: (config: unknown) => new Protected(Protected.schema.parse(unnestProtection(config) ?? {})),
    schema: Protected.schema,
  },
  [Scalp.NAME]: {
    create: (config: unknown) => new Scalp(Scalp.schema.parse(unnestProtection(config))),
    schema: Scalp.schema,
  },
  [SmaCrossover.NAME]: {
    create: (config: unknown) => new SmaCrossover(SmaCrossover.schema.parse(unnestProtection(config) ?? {})),
    schema: SmaCrossover.schema,
  },
  [TrailingStop.NAME]: {
    create: (config: unknown) => new TrailingStop(TrailingStop.schema.parse(unnestProtection(config) ?? {})),
    schema: TrailingStop.schema,
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
