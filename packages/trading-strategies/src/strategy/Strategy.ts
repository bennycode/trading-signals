import Big from 'big.js';
import type {MarketDataSource, OneMinuteBatchedCandle, TradingPair} from '@typedtrader/exchange';
import type {OrderAdvice, TradingSessionState, TradingSessionStrategy} from '../trader/index.js';
import type {MarketType} from './MarketType.js';

/** Freezes the returned value, so state cannot be edited directly and has to go through `setState()`. */
function deepFreeze(value: unknown): unknown {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

/** The state Proxy only persists top-level assignments, so nested writes have to go through {@link setState}. */
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
  readonly #stateTarget: Record<string, unknown> | null = null;

  constructor(options?: {state?: Record<string, unknown>; config?: Record<string, unknown>}) {
    if (options?.state) {
      this.#stateTarget = options.state;
      this.#proxiedState = this.#createProxy(options.state, snapshot => {
        this.state = snapshot;
      });
      this.state = {...options.state};
    }
    if (options?.config) {
      this.#proxiedConfig = this.#createProxy(options.config, snapshot => {
        this.config = snapshot;
      });
      this.config = {...options.config};
    }
  }

  async init(_market: Pick<MarketDataSource, 'getRecentCandles'>, _pair: TradingPair): Promise<void> {}

  async onCandle(candle: OneMinuteBatchedCandle, state: TradingSessionState): Promise<OrderAdvice | void> {
    this.lastBatchedCandle = candle;
    const advice = await this.processCandle(candle, state);
    this.latestAdvice = advice ? advice : undefined;
    return advice;
  }

  /**
   * Adopts a persisted snapshot, e.g. after a restart. Restoring is not a change worth
   * persisting again, so it deliberately does not trigger a save.
   */
  restoreState(persisted: Record<string, unknown>): void {
    this.#_state = persisted;
    this.#adoptSnapshot(persisted);
  }

  /** Merges `patch` into the state. Writes bypass the Proxy, so a multi-key patch persists once. */
  setState<T extends Record<string, unknown>>(patch: Partial<T>): void {
    const snapshot = this.state;
    if (!snapshot) {
      throw new Error('No state to update. Pass {state} to the Strategy constructor or call restoreState() first.');
    }

    if (this.#stateTarget) {
      this.#adoptSnapshot({...snapshot, ...patch});
      this.state = {...this.#stateTarget};
      return;
    }

    this.state = {...snapshot, ...patch};
  }

  /**
   * Strategies read their state through the Proxy, which hands out the object the Proxy wraps
   * rather than the persisted snapshot. Writing a snapshot therefore has to reach that object as
   * well, or a strategy keeps reading the values it started with and stale keys come back.
   */
  #adoptSnapshot(snapshot: Record<string, unknown>): void {
    if (!this.#stateTarget) {
      return;
    }

    for (const key of Object.keys(this.#stateTarget)) {
      if (!Object.hasOwn(snapshot, key)) {
        delete this.#stateTarget[key];
      }
    }

    Object.assign(this.#stateTarget, snapshot);
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
      // Frozen, so an unpersistable nested write throws instead of vanishing on restart.
      get: (t, property, receiver) => deepFreeze(Reflect.get(t, property, receiver)),
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
