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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Lifts the kill-switch settings of a stored config out of the `protected` key they used to be
 * nested under. A stored config outlives the code that wrote it, and these are now settings of
 * the strategy itself, so both shapes are read and a flat setting wins over a nested one.
 *
 * An absent config becomes an empty one, so a strategy that needs a setting reports that setting
 * as missing rather than reporting the whole config as the wrong type. Anything else is handed on
 * untouched: a stored `[]` or `"bad"` has to fail the strategy's schema, not be read as "default".
 */
function settingsOf(config: unknown): unknown {
  if (config === undefined || config === null) {
    return {};
  }
  if (!isRecord(config) || !isRecord(config.protected)) {
    return config;
  }
  const {protected: nested, ...flat} = config;
  return {...nested, ...flat};
}

/** Builds one strategy from a stored config. The schemas themselves are exported per strategy. */
type StrategyFactory = (config: unknown) => Strategy;

const registry: Record<string, StrategyFactory> = {
  [BuyBelowSellAbove.NAME]: config => new BuyBelowSellAbove(BuyBelowSellAbove.schema.parse(settingsOf(config))),
  [BuyOnce.NAME]: config => new BuyOnce(BuyOnce.schema.parse(settingsOf(config))),
  [CoinFlip.NAME]: config => new CoinFlip(CoinFlip.schema.parse(settingsOf(config))),
  [MeanReversion.NAME]: config => new MeanReversion(MeanReversion.schema.parse(settingsOf(config))),
  [MultiIndicatorConfluence.NAME]: config =>
    new MultiIndicatorConfluence(MultiIndicatorConfluence.schema.parse(settingsOf(config))),
  [NoopStrategy.NAME]: config => new NoopStrategy(NoopSchema.parse(settingsOf(config))),
  [Protected.NAME]: config => new Protected(Protected.schema.parse(settingsOf(config))),
  [Scalp.NAME]: config => new Scalp(Scalp.schema.parse(settingsOf(config))),
  [SmaCrossover.NAME]: config => new SmaCrossover(SmaCrossover.schema.parse(settingsOf(config))),
  [TrailingStop.NAME]: config => new TrailingStop(TrailingStop.schema.parse(settingsOf(config))),
};

export function createStrategy(name: string, config: unknown): Strategy {
  const create = registry[name];
  if (!create) {
    throw new Error(`Unknown strategy "${name}". Available: ${getStrategyNames().join(', ')}`);
  }
  return create(config);
}

export function getStrategyNames(): string[] {
  return Object.keys(registry);
}
