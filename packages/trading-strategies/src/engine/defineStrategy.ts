import Big from 'big.js';
import {ms, type StringValue} from 'ms';
import {z} from 'zod';
import {CandleBatcher, getFilledBaseAmount, ONE_MINUTE_IN_MS, OrderSide, OrderType} from '@typedtrader/exchange';
import type {BatchedCandle, Fill, OneMinuteBatchedCandle} from '@typedtrader/exchange';
import {AllAvailableAmount} from '../trader/index.js';
import type {OrderAdvice, TradingSessionState} from '../trader/index.js';
import type {MarketType} from '../strategy/MarketType.js';
import {Strategy} from '../strategy/Strategy.js';
import type {
  Amount,
  CloseRule,
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
 */
export function defineStrategy<
  Schema extends z.ZodType<Record<string, unknown>>,
  Indicators extends Record<string, IndicatorDeclaration<unknown, z.output<Schema>>>,
>(definition: {config: Schema} & StrategyDefinition<z.output<Schema>, Indicators>): StrategyConstructor<Schema> {
  type ParsedConfig = z.output<Schema>;
  type StrategyFacts = Facts<ParsedConfig, IndicatorResults<Indicators>>;

  const openRules = asList<OpenRule<StrategyFacts>>(definition.long.open);
  const closeRules = asList<CloseRule<StrategyFacts>>(definition.long.close);

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
    static schema = definition.config;

    readonly #config: ParsedConfig;
    readonly #indicators: Map<string, IndicatorHandle<unknown>>;
    /** One batcher per timeframe any rule declared, so a rule can be evaluated per bar. */
    readonly #ruleBatchers = new Map<StringValue, CandleBatcher>(
      [...openRules, ...closeRules]
        .map(timeframeOf)
        .filter((timeframe): timeframe is StringValue => timeframe !== undefined)
        .map(timeframe => [timeframe, new CandleBatcher(ms(timeframe))])
    );

    constructor(config?: z.input<Schema>) {
      const parsed: ParsedConfig = definition.config.parse(config ?? {});
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

    protected override async processCandle(
      candle: OneMinuteBatchedCandle,
      state: TradingSessionState
    ): Promise<OrderAdvice | void> {
      this.#feedIndicators(candle);
      const bars = this.#feedRuleBatchers(candle);
      const holding = this.hasSellablePosition(state);

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

      if (holding) {
        return this.#fire(closeRules, candle, bars, OrderSide.SELL);
      }

      // A strategy that ended on a terminal exit stays flat for good.
      if (this.#ledger.lastExitFinal) {
        return;
      }

      return this.#fire(openRules, candle, bars, OrderSide.BUY);
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
    #indicatorFacts(): IndicatorResults<Indicators> {
      const facts: Record<string, unknown> = {};

      for (const [name, indicator] of this.#indicators) {
        Object.defineProperty(facts, name, {
          enumerable: true,
          get: () => {
            const result = indicator.getResult();
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

      return Object.assign(this.#indicatorFacts(), {
        candle,
        close: prices.close.toNumber(),
        config: this.#config,
        entries: ledger.entries,
        exits: ledger.exits,
        high: prices.high.toNumber(),
        lastExit: lastExitPrice === null ? null : {final: ledger.lastExitFinal, price: new Big(lastExitPrice)},
        low: prices.low.toNumber(),
        position,
      });
    }

    #fire(
      rules: (OpenRule<StrategyFacts> | CloseRule<StrategyFacts>)[],
      candle: OneMinuteBatchedCandle,
      bars: Map<StringValue, BatchedCandle | undefined>,
      side: OrderSide
    ): OrderAdvice | void {
      for (const rule of rules) {
        let prices: BatchedCandle = candle;
        const timeframe = timeframeOf(rule);

        if (timeframe !== undefined) {
          const bar = bars.get(timeframe);
          // Its bar has not closed yet, so this rule has nothing new to judge.
          if (!bar) {
            continue;
          }
          prices = bar;
        }

        const facts = this.#facts(candle, prices);

        if (!this.#matches(rule, facts)) {
          continue;
        }

        const because = typeof rule.because === 'string' ? rule.because : rule.because(facts);
        const price = rule.at ? rule.at(facts) : null;
        const sizing = 'spend' in rule && rule.spend !== undefined ? rule.spend : (rule.quantity ?? 'all');
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
    }

    /** A rule waiting on an indicator that has no result yet simply does not match. */
    #matches(rule: OpenRule<StrategyFacts> | CloseRule<StrategyFacts>, facts: StrategyFacts): boolean {
      try {
        return rule.when === 'always' || rule.when(facts);
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
     * ponytail: entry price for a position this strategy did not open is taken from the candle it
     * first sees, so percentage rules measure from attach time rather than from what was actually
     * paid. Read `avg_entry_price` off the broker position once `TradingSessionState` carries it.
     */
    #openPositionIfUntracked(candle: OneMinuteBatchedCandle, state: TradingSessionState): void {
      if (new Big(this.#ledger.size).gt(0)) {
        return;
      }

      this.setState<Ledger>({
        bestPrice: candle.high.toFixed(),
        costBasis: candle.close.mul(state.baseBalance).toFixed(),
        size: state.baseBalance.toFixed(),
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
