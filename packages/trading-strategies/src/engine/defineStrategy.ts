import Big from 'big.js';
import {ms, type StringValue} from 'ms';
import type {z} from 'zod';
import {CandleBatcher, OrderSide} from '@typedtrader/exchange';
import type {BatchedCandle, Fill, MarketDataSource, OneMinuteBatchedCandle, TradingPair} from '@typedtrader/exchange';
import {holdsPosition} from '../trader/sessionBalances.js';
import {adviceFor, plannedOrder} from './advice.js';
import {factsFor} from './facts.js';
import {notices} from './notices.js';
import {gonePositionChange, heldPositionChange, ratchetedBestPrice} from './position.js';
import {firstMatch, judgeCrossings, refuseShadowedRules, timeframeOf} from './matching.js';
import {warmUpFromHistory} from './warmUp.js';
import {restoredLedger} from './legacyLedger.js';
import {afterFill, emptyLedger, type Ledger} from './ledger.js';
import type {OrderAdvice, TradingSessionState} from '../trader/index.js';
import type {MarketType} from '../strategy/MarketType.js';
import {Strategy} from '../strategy/Strategy.js';
import type {
  CloseRule,
  Facts,
  IndicatorDeclaration,
  IndicatorHandle,
  IndicatorResults,
  OpenRule,
  StrategyDefinition,
} from './types.js';

function asList<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
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

  refuseShadowedRules({closeRules, interval: definition.interval, name: definition.name, openRules});

  return class EngineStrategy extends Strategy {
    static override NAME = definition.name;
    static override marketTypes: readonly MarketType[] = definition.markets;
    static schema = config;

    readonly #config: ParsedConfig;
    /** Set when a snapshot this engine could not read was replaced, to report once a relay exists. */
    #stateWasReset = false;
    #reportedShort = false;
    readonly #indicators: Map<string, IndicatorHandle<unknown>>;
    /** One batcher per timeframe any rule declared, so a rule can be evaluated per bar. */
    readonly #ruleBatchers = new Map<StringValue, CandleBatcher>(
      [...openRules, ...closeRules]
        .map(rule => timeframeOf(rule, definition.interval))
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

    /**
     * A snapshot written by one of the strategy classes this engine replaces is translated into a
     * ledger, because the decisions in it cannot be taken again: a kill switch that fired, the
     * position it was measured against, a `bought` flag that is the whole of BuyOnce. Anything
     * else is replaced by an empty ledger, which is safe — the position is re-adopted from the
     * balance on the next candle — but loses a ratcheted trail, so it is reported rather than
     * assumed.
     */
    override restoreState(persisted: Record<string, unknown>): void {
      const {ledger, wasReset} = restoredLedger(persisted);
      this.#stateWasReset = wasReset;
      super.restoreState(ledger);
    }

    /**
     * Fetches the past bars every indicator declared and hands them over before the first live
     * candle, so a strategy whose settings come from history does not have to wait days of live
     * candles to learn them. Declarations asking for the same bars share one request.
     */
    override async init(market: Pick<MarketDataSource, 'getRecentCandles'>, pair: TradingPair): Promise<void> {
      /*
       * Reported from here rather than from `restoreState`, which runs before a session exists to
       * relay anything: the runtime restores a strategy's state and only then wires up its
       * messages, so a notice sent any earlier reaches nobody.
       */
      if (this.#stateWasReset) {
        this.onMessage?.(notices.stateReset(definition.name));
        this.#stateWasReset = false;
      }

      await warmUpFromHistory({
        declarations: definition.indicators ?? {},
        handles: this.#indicators,
        market,
        pair,
        report: this.onMessage,
      });
    }

    protected override async processCandle(
      candle: OneMinuteBatchedCandle,
      state: TradingSessionState
    ): Promise<OrderAdvice | void> {
      this.#feedIndicators(candle);
      const bars = this.#feedRuleBatchers(candle);

      if (state.shortBase.gt(0)) {
        this.#reportShortOnce();
        return;
      }

      const holding = holdsPosition(state);

      /*
       * The high of the candle a position is adopted on belongs to a time before this strategy
       * held anything, so it is not a best price it saw. Ratcheting to it would put a trailing
       * target below a price the position never had — far enough, on a candle that ran up and
       * closed back down, to sell it the moment it attached.
       */
      const {adopted} = await this.#reconcilePosition(candle, state, holding);

      if (holding && !adopted) {
        this.#ratchetBestPrice(candle);
      }

      /*
       * A terminal exit is re-placed until the position is actually gone, so a rejected order or
       * a price that recovered above the stop cannot leave the strategy holding what it decided
       * to sell.
       */
      const pending = this.#ledger.pendingFinalExit;
      if (pending && holding) {
        return adviceFor(OrderSide.SELL, pending.quantity ?? 'all', pending.price, pending.because);
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

      /*
       * The balance holds nothing, and yet the ledger still does: a sale of ours has gone through
       * at the broker and its fill has not been reported, which on Trading212 takes up to a minute.
       * Buying here would open a position between the sale and the fill that explains it — on the
       * candle after a stop fired, which is the one thing a kill switch promises cannot happen —
       * and the entry would then be averaged into a position that was already sold.
       */
      if (new Big(this.#ledger.size).gt(0) || this.#ledger.pendingFinalExit !== null) {
        return;
      }

      /*
       * An entry of ours is already working. Its fill is what counts it as an entry, so a rule
       * written as "buy once" is still eligible until that fill lands: on a broker that reports
       * fills on a poll, the candle in between would buy the position a second time.
       */
      if (state.hasOutstandingBuy) {
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

    /** Everything a rule may read, for the candle and for the bar that rule judges. */
    #facts(candle: OneMinuteBatchedCandle, prices: BatchedCandle): StrategyFacts {
      return factsFor<z.output<Schema>, Indicators>({
        candle,
        config: this.#config,
        indicators: this.#indicators,
        ledger: this.#ledger,
        prices,
      });
    }

    /**
     * Records what each `becomes()` condition says about this candle and returns the rules whose
     * condition turned true on it, which is the only thing such a rule can fire on.
     */
    #judgeCrossings(candle: OneMinuteBatchedCandle, bars: Map<StringValue, BatchedCandle | undefined>): Set<string> {
      const {answers, changed, turnedTrue} = judgeCrossings<StrategyFacts>({
        factsFor: prices => this.#facts(candle, prices),
        previous: this.#ledger.crossings,
        pricesFor: rule => this.#pricesFor(rule, candle, bars),
        slots: [
          ['close', closeRules],
          ['open', openRules],
        ],
      });

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
      const timeframe = timeframeOf(rule, definition.interval);
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
      return firstMatch<StrategyFacts>({
        crossed,
        factsFor: prices => this.#facts(candle, prices),
        place: (rule, facts) => this.#place(rule, facts, side),
        pricesFor: rule => this.#pricesFor(rule, candle, bars),
        rules,
        slot,
      });
    }

    /** Turns a rule that matched into the order it asks for, and records it when it is terminal. */
    #place(
      rule: OpenRule<StrategyFacts> | CloseRule<StrategyFacts>,
      facts: StrategyFacts,
      side: OrderSide
    ): OrderAdvice {
      const {advice, because, final, price, quantity} = plannedOrder(rule, facts, side);

      if (final) {
        this.setState<Ledger>({pendingFinalExit: {because, price, quantity}});
      }

      return advice;
    }

    /**
     * Applies what this candle changes about the position itself, and reports the changes nobody
     * asked for. Returns whether the position was adopted on this candle, which is the one candle
     * whose high is not a best price this strategy saw.
     */
    async #reconcilePosition(candle: OneMinuteBatchedCandle, state: TradingSessionState, holding: boolean) {
      const change = holding
        ? heldPositionChange(this.#ledger, state, candle)
        : gonePositionChange(this.#ledger, state, candle, openRules.length > 0);

      if (!change) {
        return {adopted: false};
      }

      this.setState<Ledger>(change.patch);

      if (!change.adopted && holding) {
        this.onMessage?.(notices.positionResized(definition.name, change.patch.size ?? '0'));
      }
      if (change.final) {
        await this.onFinish?.();
      }

      return {adopted: change.adopted};
    }

    /** Said once per session: a short does not become news again on the next candle. */
    #reportShortOnce(): void {
      if (this.#reportedShort) {
        return;
      }
      this.#reportedShort = true;
      this.onMessage?.(notices.shortHeld(definition.name));
    }

    #ratchetBestPrice(candle: OneMinuteBatchedCandle): void {
      const next = ratchetedBestPrice(this.#ledger.bestPrice, candle, definition.ratchetBy?.(this.#config));
      if (next !== null) {
        this.#ledger.bestPrice = next;
      }
    }

    async onFill(fill: Fill, state: TradingSessionState): Promise<void> {
      const patch = afterFill(this.#ledger, fill, new Big(state.tradingRules.base_min_size));
      if (!patch) {
        return;
      }
      this.setState<Ledger>(patch);

      if (patch.lastExitFinal) {
        await this.onFinish?.();
      }
    }
  };
}
