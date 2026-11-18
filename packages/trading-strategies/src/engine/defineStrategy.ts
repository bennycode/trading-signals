import Big from 'big.js';
import {ms, type StringValue} from 'ms';
import type {z} from 'zod';
import {CandleBatcher, getFilledBaseAmount, OrderSide} from '@typedtrader/exchange';
import type {BatchedCandle, Fill, MarketDataSource, OneMinuteBatchedCandle, TradingPair} from '@typedtrader/exchange';
import {holdsPosition, ownedBase} from '../trader/sessionBalances.js';
import {adviceFor, plannedOrder} from './advice.js';
import {factsFor} from './facts.js';
import {firstMatch, judgeCrossings, refuseShadowedRules, timeframeOf} from './matching.js';
import {warmUpFromHistory} from './warmUp.js';
import {
  adoptedPosition,
  afterEntryFill,
  afterExitFill,
  closedPosition,
  emptyLedger,
  LedgerSchema,
  type Ledger,
} from './ledger.js';
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

  refuseShadowedRules({
    closeRules,
    hasOpenSlot: definition.long.open !== undefined,
    name: definition.name,
    openRules,
  });

  return class EngineStrategy extends Strategy {
    static override NAME = definition.name;
    static override marketTypes: readonly MarketType[] = definition.markets;
    static schema = config;

    readonly #config: ParsedConfig;
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
     * A snapshot this engine did not write cannot be read: the classes these strategies replace
     * each persisted their own shape (a peak price, a tripped kill switch, a `bought` flag), and
     * none of it maps onto the ledger. Starting from an empty ledger is safe — the position is
     * re-adopted from the balance on the next candle — but it does lose a ratcheted trail and the
     * entry price a percentage threshold was measured from, so it is reported rather than assumed.
     */
    override restoreState(persisted: Record<string, unknown>): void {
      const parsed = LedgerSchema.safeParse(persisted);
      if (!parsed.success && Object.keys(persisted).length > 0) {
        this.onMessage?.(
          `${definition.name}: the saved state could not be read and was reset. The position is adopted from the ` +
            `current balance, so a percentage threshold now measures from the price it attaches at.`
        );
      }
      super.restoreState(parsed.success ? parsed.data : emptyLedger());
    }

    /**
     * Fetches the past bars every indicator declared and hands them over before the first live
     * candle, so a strategy whose settings come from history does not have to wait days of live
     * candles to learn them. Declarations asking for the same bars share one request.
     */
    override async init(market: Pick<MarketDataSource, 'getRecentCandles'>, pair: TradingPair): Promise<void> {
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
      const holding = holdsPosition(state);

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

      this.onMessage?.(because);
      return advice;
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

      this.setState<Ledger>(adoptedPosition(candle, ownedBase(state)));
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

      /*
       * A strategy with no entry rule is done the moment it holds nothing, however the position
       * went: it cannot buy one back, so staying alive would only let it attach to whatever is
       * bought on this pair next and sell that against a trail it never agreed to.
       */
      const final = ledger.pendingFinalExit !== null || openRules.length === 0;
      this.setState<Ledger>(closedPosition(ledger, candle.close, final));

      if (final) {
        await this.onFinish?.();
      }
    }

    async onFill(fill: Fill, _state: TradingSessionState): Promise<void> {
      const ledger = this.#ledger;
      const fillPrice = new Big(fill.price);
      const fillSizes = {executedSize: new Big(fill.size), price: fillPrice, receivedSize: getFilledBaseAmount(fill)};

      if (fill.side === OrderSide.BUY) {
        this.setState<Ledger>(afterEntryFill(ledger, fillSizes));
        return;
      }

      const exited = afterExitFill(ledger, fillSizes);
      if (!exited) {
        return;
      }
      this.setState<Ledger>(exited);

      if (exited.lastExitFinal) {
        await this.onFinish?.();
      }
    }
  };
}
