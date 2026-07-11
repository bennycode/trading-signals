import Big from 'big.js';
import {OrderSide} from '@typedtrader/exchange';
import type {Fill, OneMinuteBatchedCandle} from '@typedtrader/exchange';
import type {OrderAdvice, TradingSessionState, TradingSessionStrategy} from '../trader/index.js';
import type {MarketType} from './MarketType.js';

const LAST_FILLS_STATE_KEY = '__lastFills__';

/** Most recent fill price per side, persisted alongside the strategy's own state under a reserved key. */
type LastFills = {
  /** Price of the most recent BUY fill, as a Big string. `null` until the first buy. */
  lastBuyPrice: string | null;
  /** Price of the most recent SELL fill, as a Big string. `null` until the first sell. */
  lastSellPrice: string | null;
};

type LastFillsContainer = {[LAST_FILLS_STATE_KEY]: LastFills};

const defaultLastFills = (): LastFills => ({lastBuyPrice: null, lastSellPrice: null});

export abstract class Strategy implements TradingSessionStrategy {
  static NAME: string;

  /**
   * Market regimes the strategy is designed to operate in. Subclasses should
   * override this with the regime(s) that match their logic. An empty array
   * means the strategy has not been categorized.
   */
  static marketTypes: readonly MarketType[] = [];

  latestAdvice: OrderAdvice | undefined = undefined;
  lastBatchedCandle: OneMinuteBatchedCandle | undefined = undefined;

  /** Called automatically whenever `state` or `config` changes. Set by the runtime (e.g., StrategyMonitor). */
  onSave?: () => void;

  /**
   * Called when the strategy signals it is terminally done (e.g. after a kill-switch
   * has fully exited the position). Set by the runtime (e.g., StrategyMonitor) to trigger
   * session teardown and persistence cleanup. May be an async function — the return
   * value is intentionally fire-and-forget at every current call site.
   */
  onFinish?: () => void | Promise<void>;

  /**
   * Set by the `TradingSession` when the strategy is attached. Strategies call it to
   * surface a user-facing message; the session re-emits it as a `'message'` event,
   * which downstream consumers (e.g. `StrategyMonitor`) forward to the user. Strategies
   * are responsible for not being chatty — every call reaches the user.
   */
  onMessage?: (text: string) => void;

  #_state: Record<string, unknown> | null = null;
  get state(): Record<string, unknown> | null {
    return this.#_state;
  }
  set state(value: Record<string, unknown> | null) {
    this.#_state = value;
    this.onSave?.();
  }

  #_config: Record<string, unknown> | null = null;
  get config(): Record<string, unknown> | null {
    return this.#_config;
  }
  set config(value: Record<string, unknown> | null) {
    this.#_config = value;
    this.onSave?.();
  }

  readonly #proxiedState: Record<string, unknown> | null = null;
  readonly #proxiedConfig: Record<string, unknown> | null = null;

  constructor(options?: {state?: Record<string, unknown>; config?: Record<string, unknown>}) {
    /*
     * The base always keeps a state object so it can track the open position from fills,
     * even for strategies that don't declare any state of their own. A restored position
     * (present in the provided state) is preserved rather than reset.
     */
    const providedState = options?.state ?? {};
    const initialState: Record<string, unknown> = {
      ...providedState,
      [LAST_FILLS_STATE_KEY]: providedState[LAST_FILLS_STATE_KEY] ?? defaultLastFills(),
    };
    this.#proxiedState = this.#createProxy(initialState, snapshot => {
      this.state = snapshot;
    });
    this.state = {...initialState};

    if (options?.config) {
      this.#proxiedConfig = this.#createProxy(options.config, snapshot => {
        this.config = snapshot;
      });
      this.config = {...options.config};
    }
  }

  async onCandle(candle: OneMinuteBatchedCandle, state: TradingSessionState): Promise<OrderAdvice | void> {
    this.lastBatchedCandle = candle;
    const advice = await this.processCandle(candle, state);
    this.latestAdvice = advice ? advice : undefined;
    return advice;
  }

  restoreState(persisted: Record<string, unknown>): void {
    this.#_state = persisted;
  }

  /**
   * Records the most recent BUY / SELL fill price, exposed as {@link lastBuyPrice} /
   * {@link lastSellPrice}, so a strategy can measure an exit against its entry without
   * bookkeeping of its own. Subclasses that override `onFill` MUST call
   * `super.onFill(fill, state)` to keep this accurate.
   */
  async onFill(fill: Fill, _state: TradingSessionState): Promise<void> {
    const patch: Partial<LastFills> =
      fill.side === OrderSide.BUY ? {lastBuyPrice: fill.price} : {lastSellPrice: fill.price};
    this.#setLastFills(patch);
  }

  /** Price of the most recent BUY fill, or `undefined` if there hasn't been one. */
  get lastBuyPrice(): Big | undefined {
    const price = this.#lastFills.lastBuyPrice;
    return price === null ? undefined : new Big(price);
  }

  /** Price of the most recent SELL fill, or `undefined` if there hasn't been one. */
  get lastSellPrice(): Big | undefined {
    const price = this.#lastFills.lastSellPrice;
    return price === null ? undefined : new Big(price);
  }

  get #lastFills(): LastFills {
    return this.getProxiedState<LastFillsContainer>()[LAST_FILLS_STATE_KEY];
  }

  #setLastFills(patch: Partial<LastFills>): void {
    /*
     * Reassigning the reserved top-level key trips the state Proxy's set trap, which fires
     * `onSave` so the runtime persists it (nested mutations would bypass persistence).
     */
    const proxied = this.getProxiedState<LastFillsContainer>();
    proxied[LAST_FILLS_STATE_KEY] = {...proxied[LAST_FILLS_STATE_KEY], ...patch};
  }

  /**
   * Whether the available base balance is large enough to place an order. Anything below
   * the exchange's minimum order size (`base_min_size`) is unsellable dust, so for
   * position/exit purposes it counts as no position. Gating on this threshold rather than
   * `> 0` stops a tiny residue left after a fill from being treated as an open position.
   */
  protected hasSellablePosition(state: TradingSessionState) {
    return state.baseBalance.gte(new Big(state.tradingRules.base_min_size));
  }

  protected getProxiedState<T extends Record<string, unknown>>(): T {
    if (!this.#proxiedState) {
      throw new Error('No state was provided to super(). Pass { state: ... } to the Strategy constructor.');
    }
    return this.#proxiedState as T;
  }

  protected getProxiedConfig<T extends Record<string, unknown>>(): T {
    if (!this.#proxiedConfig) {
      throw new Error('No config was provided to super(). Pass { config: ... } to the Strategy constructor.');
    }
    return this.#proxiedConfig as T;
  }

  #createProxy(
    target: Record<string, unknown>,
    persist: (snapshot: Record<string, unknown>) => void
  ): Record<string, unknown> {
    return new Proxy(target, {
      set: (t, property, value, receiver) => {
        Reflect.set(t, property, value, receiver);
        persist({...t});
        return true;
      },
    });
  }

  protected abstract processCandle(
    candle: OneMinuteBatchedCandle,
    state: TradingSessionState
  ): Promise<OrderAdvice | void>;
}
