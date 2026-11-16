import type Big from 'big.js';
import type {StringValue} from 'ms';
import type {OneMinuteBatchedCandle} from '@typedtrader/exchange';
import type {MarketType} from '../strategy/MarketType.js';

/** A size written on a rule. `'all'` means the whole balance or the whole position. */
export type Amount = Big | string | number | 'all';

/** A base-denominated buy cannot be sized `'all'`: without a price there is no share count to derive. */
export type ExplicitAmount = Big | string | number;

export interface PositionFacts {
  /** Average price paid across every entry fill, weighted by size. */
  entryPrice: Big;
  /**
   * The most favourable price seen since the position opened, which is the running high for a
   * long. Named for the position's benefit rather than the chart's direction, so that a short's
   * running low will read the same way without renaming every trailing-stop rule.
   */
  bestPrice: Big;
  side: 'long';
  size: Big;
  /** Profit in percent, positive whenever the position is winning. */
  unrealizedPct: Big;
}

export interface ExitFacts {
  /** Candle close at which the exit rule fired, not necessarily the price it filled at. */
  price: Big;
  /** Whether the rule behind this exit ended the strategy, as `stopLoss()` does. */
  final: boolean;
}

/**
 * Everything a rule may read. Rules get no access to the strategy instance, the broker or the
 * clock, which is what lets the engine evaluate them in any order and skip the ones it does not
 * reach.
 */
export type Facts<Config, Indicators> = {
  candle: OneMinuteBatchedCandle;
  /** Candle close as a number, ready to compare against indicator results. */
  close: number;
  config: Config;
  /** How many positions this strategy has opened. */
  entries: number;
  /** How many positions this strategy has closed. */
  exits: number;
  high: number;
  /** The exit this strategy made most recently, or `null` until it has closed a position. */
  lastExit: ExitFacts | null;
  low: number;
  /** The open position, or `null` while flat. */
  position: PositionFacts | null;
} & Indicators;

interface RuleBase<F> {
  /** Why this rule fired, shown to the user and recorded on the order. */
  because: string | ((facts: F) => string);
  /** Limit price. A rule without it places a market order. */
  at?: (facts: F) => Big;
  /**
   * Overrides the strategy's `interval` for this one rule: it is then
   * evaluated only when a bar of this size completes, and reads `close`, `high` and `low` from
   * that bar. `'1m'` is the candle itself, which is what a protective rule wants.
   */
  timeframe?: StringValue;
  when: 'always' | ((facts: F) => boolean);
}

/**
 * A rule that opens a position. `spend` is counter currency (cash), `quantity` is base asset
 * (shares or coins); the engine derives the order side from the slot the rule sits in.
 */
export type OpenRule<F> = RuleBase<F> & ({quantity?: never; spend: Amount} | {quantity: ExplicitAmount; spend?: never});

/** A rule that closes a position. Omitting `quantity` closes all of it. */
export type CloseRule<F> = RuleBase<F> & {
  quantity?: Amount;
  /**
   * `'finish'` makes the exit terminal: the engine keeps re-placing it until the position is
   * gone, never opens again, and then tears the session down.
   */
  then?: 'finish';
};

/**
 * An indicator the engine drives. The input type an indicator consumes is erased here on
 * purpose: {@link every} binds it when the indicator is declared, so a definition's generics stay
 * free of it and inference reaches the rules.
 */
export interface IndicatorHandle<Result> {
  add(candle: OneMinuteBatchedCandle): void;
  getResult(): Result | null | undefined;
}

export interface IndicatorDeclaration<Result, Config> {
  create: (config: Config) => IndicatorHandle<Result>;
}

export type IndicatorResults<Indicators> = {
  [Name in keyof Indicators]: Indicators[Name] extends IndicatorDeclaration<infer Result, infer _Config>
    ? Result
    : never;
};

export interface StrategyDefinition<Config, Indicators> {
  /** Package-style identifier the registry and the database store, e.g. `@typedtrader/strategy-x`. */
  name: string;
  /** Indicators the engine creates, feeds and warms up. Rules read their results by these names. */
  indicators?: Indicators;
  /**
   * How often rules are evaluated. The engine runs them when a bar of this size completes, and
   * reports `close`, `high` and `low` from that bar. Omit it, or set `'1m'`, to judge every
   * candle, which is what a rule reading something other than an indicator wants. A single rule
   * can opt out with its own `timeframe`.
   */
  interval?: StringValue;
  long: {
    close?:
      | CloseRule<Facts<Config, IndicatorResults<Indicators>>>
      | CloseRule<Facts<Config, IndicatorResults<Indicators>>>[];
    open?:
      | OpenRule<Facts<Config, IndicatorResults<Indicators>>>
      | OpenRule<Facts<Config, IndicatorResults<Indicators>>>[];
  };
  markets: readonly MarketType[];
}
