import Big from 'big.js';
import {ms, type StringValue} from 'ms';
import {z} from 'zod';
import {CandleBatcher, getFilledBaseAmount, ONE_MINUTE_IN_MS, OrderSide, OrderType} from '@typedtrader/exchange';
import type {
  BatchedCandle,
  Candle,
  Fill,
  MarketDataSource,
  OneMinuteBatchedCandle,
  TradingPair,
} from '@typedtrader/exchange';
import {AllAvailableAmount} from '../trader/index.js';
import type {OrderAdvice, TradingSessionState} from '../trader/index.js';
import type {MarketType} from '../strategy/MarketType.js';
import {Strategy} from '../strategy/Strategy.js';
import type {
  Amount,
  CloseRule,
  Crossing,
  Facts,
  IndicatorDeclaration,
  IndicatorHandle,
  IndicatorResults,
  OpenRule,
  PositionFacts,
  StrategyDefinition,
} from './types.js';

const bigString = z.string().refine(value => {
  try {
    new Big(value);
    return true;
  } catch {
    return false;
  }
}, 'Must be a number');

/**
 * Everything the engine persists. Strategy authors never write state: a rule reads facts and
 * returns an order, so the only thing worth surviving a restart is what the engine itself tracks.
 */
const LedgerSchema = z.object({
  /** Most favourable price seen since the position opened, `'0'` while flat. */
  bestPrice: bigString,
  /** Sum of `price × size` across every entry fill, which divided by `size` gives the entry price. */
  costBasis: bigString,
  /**
   * The last answer each `becomes()` condition gave, keyed by the rule's slot and position. It is
   * persisted because a crossing is a comparison against the previous candle, which a restart
   * would otherwise lose, and a missing entry means "not judged yet", which never fires.
   */
  crossings: z.record(z.string(), z.boolean()),
  entries: z.number().int().nonnegative(),
  exits: z.number().int().nonnegative(),
  /** `true` once a terminal exit has fully filled. The engine never opens again after that. */
  lastExitFinal: z.boolean(),
  lastExitPrice: bigString.nullable(),
  /**
   * A terminal exit that has been placed but not yet filled. Kept so the engine re-places the
   * same order on every candle until the position is gone, rather than relying on the rule that
   * produced it still matching, which a bounce in price would undo.
   */
  pendingFinalExit: z
    .object({because: z.string(), price: bigString.nullable(), quantity: bigString.nullable()})
    .nullable(),
  size: bigString,
});

export type Ledger = z.infer<typeof LedgerSchema>;

const emptyLedger = (): Ledger => ({
  bestPrice: '0',
  costBasis: '0',
  crossings: {},
  entries: 0,
  exits: 0,
  lastExitFinal: false,
  lastExitPrice: null,
  pendingFinalExit: null,
  size: '0',
});

function asList<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

/** `'all'` reaches the executor as a sentinel; anything else is a concrete size. */
function toAmount(value: Amount): Big | typeof AllAvailableAmount {
  return value === 'all' ? AllAvailableAmount : new Big(value);
}

/**
 * Thrown by a fact getter whose indicator has no result yet. The engine catches it per rule and
 * reads it as "this rule cannot judge anything yet", which is what lets a rule that reads no
 * indicator run during warm-up.
 */
export class IndicatorNotReady extends Error {
  constructor(name: string) {
    super(`Indicator "${name}" has no result yet`);
  }
}

/** A strategy the engine built. Identical to any other {@link Strategy} apart from the ledger. */
export interface EngineStrategy extends Strategy {
  /** Read-only snapshot of what the engine tracks. Useful for tests and diagnostics. */
  readonly ledger: Readonly<Ledger>;
}

export type StrategyConstructor<Schema extends z.ZodType> = {
  marketTypes: readonly MarketType[];
  NAME: string;
  /** The config schema, which the registry and the docs site read to render a strategy's settings. */
  schema: Schema;
  new (config?: z.input<Schema>): EngineStrategy;
};

/**
 * Builds a strategy from its trading rules. The engine owns candle batching, indicator warm-up,
 * position tracking, persistence and the order in which rules run, so a definition contains
 * nothing but the conditions under which the strategy opens and closes a position.
 *
 * Rules are evaluated top to bottom and the first match wins, which is why a protective rule
 * belongs at the top of a `close` list. At most one order is placed per candle.
 *
 * The config schema is passed first and the rules second, so that by the time the rules are
 * checked their `config` is the parsed shape of that schema rather than something to annotate.
 */
export function defineStrategy<Schema extends z.ZodType<Record<string, unknown>>>(config: Schema) {
  // The default is what a strategy without indicators resolves to, so its rules still read facts.
  return function fromRules<
    Indicators extends Record<string, IndicatorDeclaration<unknown, z.output<Schema>>> = Record<never, never>,
  >(
    /*
     * `indicators` is the only place the engine infers the indicator types from. Blocking
     * inference everywhere else stops a strategy-agnostic helper such as `stopLoss()`, whose
     * facts are deliberately narrower, from being taken as evidence of what the facts are.
     */
    definition: {indicators?: Indicators} & StrategyDefinition<z.output<Schema>, NoInfer<Indicators>>
  ): StrategyConstructor<Schema> {
    return build<Schema, Indicators>(config, definition);
  };
}

function build<
  Schema extends z.ZodType<Record<string, unknown>>,
  Indicators extends Record<string, IndicatorDeclaration<unknown, z.output<Schema>>>,
>(config: Schema, definition: StrategyDefinition<z.output<Schema>, Indicators>): StrategyConstructor<Schema> {
  type ParsedConfig = z.output<Schema>;
  type StrategyFacts = Facts<ParsedConfig, IndicatorResults<Indicators>>;

  const openRules = asList<OpenRule<StrategyFacts>>(definition.long.open);
  const closeRules = asList<CloseRule<StrategyFacts>>(definition.long.close);

  type Slot = 'close' | 'open';

  /** A rule is identified by where it sits, which is fixed once the strategy is defined. */
  function keyOf(slot: Slot, index: number): string {
    return `${slot}:${index}`;
  }

  function isCrossing(when: OpenRule<StrategyFacts>['when']): when is Crossing<StrategyFacts> {
    return typeof when === 'object';
  }

  /**
   * A rule's own `timeframe` wins over the strategy's `interval`. A minute is the size of the
   * candles a strategy receives, so it needs no batching and resolves to `undefined`: judge every
   * candle.
   */
  function timeframeOf(rule: OpenRule<StrategyFacts> | CloseRule<StrategyFacts>): StringValue | undefined {
    const timeframe = rule.timeframe ?? definition.interval;
    return timeframe === undefined || ms(timeframe) <= ONE_MINUTE_IN_MS ? undefined : timeframe;
  }

  const alwaysIndex = [...openRules, ...closeRules].findIndex(rule => rule.when === 'always');
  const lastOfEither = openRules.length > 0 && closeRules.length > 0;
  if (alwaysIndex !== -1 && !lastOfEither) {
    const list = definition.long.open === undefined ? closeRules : openRules;
    if (alwaysIndex < list.length - 1) {
      throw new Error(`${definition.name}: a rule with when: 'always' shadows every rule below it`);
    }
  }

  return class EngineStrategy extends Strategy {
    static override NAME = definition.name;
    static override marketTypes: readonly MarketType[] = definition.markets;
    static schema = config;

    readonly #config: ParsedConfig;
    readonly #indicators: Map<string, IndicatorHandle<unknown>>;
    /** One batcher per timeframe any rule declared, so a rule can be evaluated per bar. */
    readonly #ruleBatchers = new Map<StringValue, CandleBatcher>(
      [...openRules, ...closeRules]
        .map(timeframeOf)
        .filter((timeframe): timeframe is StringValue => timeframe !== undefined)
        .map(timeframe => [timeframe, new CandleBatcher(ms(timeframe))])
    );

    constructor(settings?: z.input<Schema>) {
      const parsed: ParsedConfig = config.parse(settings ?? {});
      super({config: parsed, state: emptyLedger()});
      this.#config = parsed;
      this.#indicators = new Map(
        Object.entries(definition.indicators ?? {}).map(([name, declaration]) => [name, declaration.create(parsed)])
      );
    }

    get #ledger(): Ledger {
      return this.getProxiedState<Ledger>();
    }

    /** Read-only snapshot of what the engine tracks. Useful for tests and diagnostics. */
    get ledger(): Readonly<Ledger> {
      return {...this.#ledger};
    }

    override restoreState(persisted: Record<string, unknown>): void {
      const parsed = LedgerSchema.safeParse(persisted);
      super.restoreState(parsed.success ? parsed.data : emptyLedger());
    }

    /**
     * Fetches the past bars every indicator declared and hands them over before the first live
     * candle, so a strategy whose settings come from history does not have to wait days of live
     * candles to learn them. Declarations asking for the same bars share one request.
     */
    override async init(market: Pick<MarketDataSource, 'getRecentCandles'>, pair: TradingPair): Promise<void> {
      const requests = new Map<string, {count: number; handles: IndicatorHandle<unknown>[]; interval: StringValue}>();

      for (const [name, declaration] of Object.entries(definition.indicators ?? {})) {
        const {history} = declaration;
        const handle = this.#indicators.get(name);
        if (!history || !handle?.warmUp) {
          continue;
        }
        const key = `${history.count}:${history.interval}`;
        const request = requests.get(key) ?? {count: history.count, handles: [], interval: history.interval};
        request.handles.push(handle);
        requests.set(key, request);
      }

      for (const {count, handles, interval} of requests.values()) {
        let candles: Candle[];
        try {
          candles = await market.getRecentCandles(pair, count, ms(interval));
        } catch (error) {
          /*
           * History is a convenience, never a precondition: a broker that cannot serve it leaves
           * the declaration to decide on nothing, which is what keeps a strategy from refusing to
           * start over an exchange's missing candle endpoint.
           */
          this.onMessage?.(`Could not load ${count} bars of ${interval} history: ${String(error)}`);
          continue;
        }
        for (const handle of handles) {
          handle.warmUp?.(candles);
        }
      }
    }

    protected override async processCandle(
      candle: OneMinuteBatchedCandle,
      state: TradingSessionState
    ): Promise<OrderAdvice | void> {
      this.#feedIndicators(candle);
      const bars = this.#feedRuleBatchers(candle);
      const holding = this.#holds(state);

      if (holding) {
        this.#openPositionIfUntracked(candle, state);
        this.#ratchetBestPrice(candle);
      } else {
        await this.#forgetPositionThatIsGone(candle);
      }

      /*
       * A terminal exit is re-placed until the position is actually gone, so a rejected order or
       * a price that recovered above the stop cannot leave the strategy holding what it decided
       * to sell.
       */
      const pending = this.#ledger.pendingFinalExit;
      if (pending && holding) {
        return this.#advice(OrderSide.SELL, pending.quantity ?? 'all', pending.price, pending.because);
      }

      /*
       * Crossings are judged for every rule, in both slots, before any rule fires. A crossing is
       * a comparison against the last answer, so a rule that went unevaluated (because a rule
       * above it fired, or because the position was on the other side) would come back with a
       * stale one and read a move that never happened.
       */
      const crossed = this.#judgeCrossings(candle, bars);

      if (holding) {
        return this.#fire(closeRules, 'close', candle, bars, crossed, OrderSide.SELL);
      }

      // A strategy that ended on a terminal exit stays flat for good.
      if (this.#ledger.lastExitFinal) {
        return;
      }

      return this.#fire(openRules, 'open', candle, bars, crossed, OrderSide.BUY);
    }

    /** Batchers are fed on every candle so a rule that is skipped cannot desynchronise its bars. */
    #feedRuleBatchers(candle: OneMinuteBatchedCandle): Map<StringValue, BatchedCandle | undefined> {
      const bars = new Map<StringValue, BatchedCandle | undefined>();
      for (const [timeframe, batcher] of this.#ruleBatchers) {
        bars.set(timeframe, batcher.addToBatch(candle));
      }
      return bars;
    }

    /**
     * Indicators are fed on every candle, including ones where no rule runs, so a short-circuited
     * rule list can never cost an indicator its data.
     */
    #feedIndicators(candle: OneMinuteBatchedCandle): void {
      for (const indicator of this.#indicators.values()) {
        indicator.add(candle);
      }
    }

    /**
     * Indicator results reach rules through getters that throw {@link IndicatorNotReady} while the
     * indicator is still warming up. That replaces each strategy's own warm-up check: a rule that
     * reads an indicator waits for it, a rule that does not (a stop-loss) runs from the first
     * candle, and no rule body needs a null check. Facts are therefore built, never spread.
     */
    #indicatorFacts(read: (indicator: IndicatorHandle<unknown>) => unknown): IndicatorResults<Indicators> {
      const facts: Record<string, unknown> = {};

      for (const [name, indicator] of this.#indicators) {
        Object.defineProperty(facts, name, {
          enumerable: true,
          get: () => {
            const result = read(indicator);
            if (result === undefined || result === null) {
              throw new IndicatorNotReady(name);
            }
            return result;
          },
        });
      }

      return facts as IndicatorResults<Indicators>;
    }

    /** `prices` is the candle itself, or the completed bar of a rule that declared a timeframe. */
    #facts(candle: OneMinuteBatchedCandle, prices: BatchedCandle): StrategyFacts {
      const ledger = this.#ledger;
      const size = new Big(ledger.size);
      const lastExitPrice = ledger.lastExitPrice;

      let position: PositionFacts | null = null;
      if (size.gt(0)) {
        const entryPrice = new Big(ledger.costBasis).div(size);
        position = {
          bestPrice: new Big(ledger.bestPrice),
          entryPrice,
          side: 'long',
          size,
          unrealizedPct: candle.close.minus(entryPrice).div(entryPrice).mul(100),
        };
      }

      return Object.assign(
        this.#indicatorFacts(indicator => indicator.getResult()),
        {
          candle,
          close: prices.close.toNumber(),
          config: this.#config,
          entries: ledger.entries,
          exits: ledger.exits,
          high: prices.high.toNumber(),
          lastExit: lastExitPrice === null ? null : {final: ledger.lastExitFinal, price: new Big(lastExitPrice)},
          low: prices.low.toNumber(),
          position,
        }
      );
    }

    /**
     * Records what each `becomes()` condition says about this candle and returns the rules whose
     * condition turned true on it, which is the only thing such a rule can fire on.
     */
    #judgeCrossings(candle: OneMinuteBatchedCandle, bars: Map<StringValue, BatchedCandle | undefined>): Set<string> {
      const turnedTrue = new Set<string>();
      const answers = {...this.#ledger.crossings};
      let changed = false;

      for (const [slot, rules] of [
        ['close', closeRules],
        ['open', openRules],
      ] as const) {
        for (const [index, rule] of rules.entries()) {
          const {when} = rule;
          if (!isCrossing(when)) {
            continue;
          }

          const prices = this.#pricesFor(rule, candle, bars);
          // Its bar has not closed yet, so there is nothing new to compare against.
          if (!prices) {
            continue;
          }

          let now: boolean;
          try {
            now = when.becomes(this.#facts(candle, prices));
          } catch (error) {
            if (error instanceof IndicatorNotReady) {
              continue;
            }
            throw error;
          }

          const key = keyOf(slot, index);
          if (now && answers[key] === false) {
            turnedTrue.add(key);
          }
          if (answers[key] !== now) {
            answers[key] = now;
            changed = true;
          }
        }
      }

      if (changed) {
        this.setState<Ledger>({crossings: answers});
      }
      return turnedTrue;
    }

    /** The candle a rule judges: its own completed bar, or `undefined` while that bar is open. */
    #pricesFor(
      rule: OpenRule<StrategyFacts> | CloseRule<StrategyFacts>,
      candle: OneMinuteBatchedCandle,
      bars: Map<StringValue, BatchedCandle | undefined>
    ): BatchedCandle | undefined {
      const timeframe = timeframeOf(rule);
      return timeframe === undefined ? candle : bars.get(timeframe);
    }

    #fire(
      rules: (OpenRule<StrategyFacts> | CloseRule<StrategyFacts>)[],
      slot: Slot,
      candle: OneMinuteBatchedCandle,
      bars: Map<StringValue, BatchedCandle | undefined>,
      crossed: Set<string>,
      side: OrderSide
    ): OrderAdvice | void {
      for (const [index, rule] of rules.entries()) {
        const prices = this.#pricesFor(rule, candle, bars);
        // Its bar has not closed yet, so this rule has nothing new to judge.
        if (!prices) {
          continue;
        }

        const facts = this.#facts(candle, prices);

        if (!this.#matches(rule, facts, crossed.has(keyOf(slot, index)))) {
          continue;
        }

        /*
         * A rule's reason, price and size read the same facts its condition did, so an indicator
         * that is not ready is read here the same way: this rule cannot act yet, and the next one
         * gets its turn. Catching it around the whole rule rather than around the condition alone
         * is what lets `when: 'always'` price an order off an indicator.
         */
        try {
          return this.#place(rule, facts, side);
        } catch (error) {
          if (error instanceof IndicatorNotReady) {
            continue;
          }
          throw error;
        }
      }
    }

    /** Turns a rule that matched into the order it asks for, and records it when it is terminal. */
    #place(
      rule: OpenRule<StrategyFacts> | CloseRule<StrategyFacts>,
      facts: StrategyFacts,
      side: OrderSide
    ): OrderAdvice {
      const because = typeof rule.because === 'string' ? rule.because : rule.because(facts);
      const price = rule.limit?.(facts) ?? null;
      const written = 'spend' in rule && rule.spend !== undefined ? rule.spend : (rule.quantity ?? 'all');
      const sizing = typeof written === 'function' ? written(facts) : written;
      const spending = side === OrderSide.BUY && 'spend' in rule && rule.spend !== undefined;

      if ('then' in rule && rule.then === 'finish') {
        this.setState<Ledger>({
          pendingFinalExit: {
            because,
            price: price ? price.toFixed() : null,
            quantity: sizing === 'all' ? null : new Big(sizing).toFixed(),
          },
        });
      }

      this.onMessage?.(because);
      return this.#advice(side, sizing, price ? price.toFixed() : null, because, spending);
    }

    /** A rule waiting on an indicator that has no result yet simply does not match. */
    #matches(
      rule: OpenRule<StrategyFacts> | CloseRule<StrategyFacts>,
      facts: StrategyFacts,
      turnedTrue: boolean
    ): boolean {
      const {when} = rule;
      if (when === 'always') {
        return true;
      }
      // Already judged, against the previous candle, which is the whole point of a crossing.
      if (isCrossing(when)) {
        return turnedTrue;
      }

      try {
        return when(facts);
      } catch (error) {
        if (error instanceof IndicatorNotReady) {
          return false;
        }
        throw error;
      }
    }

    #advice(side: OrderSide, sizing: Amount, price: string | null, because: string, spending = false): OrderAdvice {
      if (price !== null) {
        const limitPrice = new Big(price);
        /*
         * A limit order is always denominated in base (see `LimitOrderAdvice`), so a `spend`
         * written on the rule is converted at the limit price we are about to offer.
         */
        const amount = spending && sizing !== 'all' ? new Big(sizing).div(limitPrice) : toAmount(sizing);
        return {amount, amountIn: 'base', price: limitPrice, reason: because, side, type: OrderType.LIMIT};
      }

      if (side === OrderSide.BUY && spending) {
        return {
          amount: toAmount(sizing),
          amountIn: 'counter',
          reason: because,
          side: OrderSide.BUY,
          type: OrderType.MARKET,
        };
      }

      if (side === OrderSide.BUY) {
        // A base-denominated market buy needs an explicit quantity, which `OpenRule` enforces.
        return {
          amount: new Big(sizing === 'all' ? 0 : sizing),
          amountIn: 'base',
          reason: because,
          side: OrderSide.BUY,
          type: OrderType.MARKET,
        };
      }

      return {
        amount: toAmount(sizing),
        amountIn: 'base',
        reason: because,
        side: OrderSide.SELL,
        type: OrderType.MARKET,
      };
    }

    /**
     * The position as the strategy owns it, which is not the same as what it can trade: an unfilled
     * limit sell of its own holds the balance it is offering. Counting only what is available would
     * read that resting order as a position that had disappeared, and the engine would clear its
     * ledger, re-enter, and leave the old order to fill later on its own.
     */
    #positionSize(state: TradingSessionState): Big {
      return state.baseBalance.plus(state.baseBalanceOnHold);
    }

    /** Dust below the exchange's minimum order size is not a position, whoever is holding it. */
    #holds(state: TradingSessionState): boolean {
      return this.#positionSize(state).gte(new Big(state.tradingRules.base_min_size));
    }

    /**
     * ponytail: entry price for a position this strategy did not open is taken from the candle it
     * first sees, so percentage rules measure from attach time rather than from what was actually
     * paid. Read `avg_entry_price` off the broker position once `TradingSessionState` carries it.
     */
    #openPositionIfUntracked(candle: OneMinuteBatchedCandle, state: TradingSessionState): void {
      if (new Big(this.#ledger.size).gt(0)) {
        return;
      }

      const size = this.#positionSize(state);
      this.setState<Ledger>({
        bestPrice: candle.high.toFixed(),
        costBasis: candle.close.mul(size).toFixed(),
        size: size.toFixed(),
      });
    }

    #ratchetBestPrice(candle: OneMinuteBatchedCandle): void {
      if (candle.high.gt(new Big(this.#ledger.bestPrice))) {
        this.#ledger.bestPrice = candle.high.toFixed();
      }
    }

    /**
     * The position can disappear without a fill of ours: sold by hand, by a rebalance or by
     * another strategy. Clearing the ledger here is what stops the engine reporting a position
     * that no longer exists, and it completes a terminal exit whose fill we never saw.
     */
    async #forgetPositionThatIsGone(candle: OneMinuteBatchedCandle): Promise<void> {
      const ledger = this.#ledger;
      if (new Big(ledger.size).lte(0)) {
        return;
      }

      const wasFinal = ledger.pendingFinalExit !== null;
      this.setState<Ledger>({
        bestPrice: '0',
        costBasis: '0',
        exits: ledger.exits + 1,
        lastExitFinal: wasFinal,
        lastExitPrice: candle.close.toFixed(),
        pendingFinalExit: null,
        size: '0',
      });

      if (wasFinal) {
        await this.onFinish?.();
      }
    }

    async onFill(fill: Fill, _state: TradingSessionState): Promise<void> {
      const ledger = this.#ledger;
      const fillPrice = new Big(fill.price);
      const executedSize = new Big(fill.size);
      const receivedSize = getFilledBaseAmount(fill);
      const size = new Big(ledger.size);

      if (fill.side === OrderSide.BUY) {
        this.setState<Ledger>({
          bestPrice: size.lte(0) || fillPrice.gt(new Big(ledger.bestPrice)) ? fillPrice.toFixed() : ledger.bestPrice,
          costBasis: new Big(ledger.costBasis).plus(fillPrice.mul(executedSize)).toFixed(),
          entries: size.lte(0) ? ledger.entries + 1 : ledger.entries,
          size: size.plus(receivedSize).toFixed(),
        });
        return;
      }

      if (size.lte(0)) {
        return;
      }

      const entryPrice = new Big(ledger.costBasis).div(size);
      const remaining = size.minus(receivedSize);

      if (remaining.gt(0)) {
        this.setState<Ledger>({
          costBasis: entryPrice.mul(remaining).toFixed(),
          size: remaining.toFixed(),
        });
        return;
      }

      const wasFinal = ledger.pendingFinalExit !== null;
      this.setState<Ledger>({
        bestPrice: '0',
        costBasis: '0',
        exits: ledger.exits + 1,
        lastExitFinal: wasFinal,
        lastExitPrice: fillPrice.toFixed(),
        pendingFinalExit: null,
        size: '0',
      });

      if (wasFinal) {
        await this.onFinish?.();
      }
    }
  };
}
