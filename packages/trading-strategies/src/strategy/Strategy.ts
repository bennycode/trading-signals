import type {OneMinuteBatchedCandle, OrderAdvice, TradingSessionState, TradingSessionStrategy} from '@typedtrader/exchange';

export abstract class Strategy implements TradingSessionStrategy {
  static NAME: string;

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

  #proxiedState: Record<string, unknown> | null = null;
  #proxiedConfig: Record<string, unknown> | null = null;

  constructor(options?: {state?: Record<string, unknown>; config?: Record<string, unknown>}) {
    if (options?.state) {
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

  async onCandle(candle: OneMinuteBatchedCandle, state: TradingSessionState): Promise<OrderAdvice | void> {
    this.lastBatchedCandle = candle;
    const advice = await this.processCandle(candle, state);
    this.latestAdvice = advice ? advice : undefined;
    return advice;
  }

  restoreState(persisted: Record<string, unknown>): void {
    this.#_state = persisted;
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

  protected abstract processCandle(candle: OneMinuteBatchedCandle, state: TradingSessionState): Promise<OrderAdvice | void>;
}
