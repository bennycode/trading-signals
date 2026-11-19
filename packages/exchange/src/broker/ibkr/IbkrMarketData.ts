import {randomUUID} from 'node:crypto';
import {ms} from 'ms';
import type {Candle, CandleImportRequest} from '../Broker.js';
import {MarketDataSource} from '../MarketDataSource.js';
import type {TradingPair} from '../TradingPair.js';
import {IbkrAPI} from './api/IbkrAPI.js';
import {IbkrBrokerMapper} from './IbkrBrokerMapper.js';
import {IbkrConidResolver} from './IbkrConidResolver.js';

/**
 * Candles from IBKR's own history endpoint, so a strategy needs no second data provider.
 *
 * The endpoint answers from the gateway's logged-in session and needed no market-data
 * subscription for US equities when this was checked against a live account.
 *
 * Streaming goes through polling rather than IBKR's WebSocket, which needs its own session
 * handshake and re-subscription on every reconnect; a candle feed gains nothing from it, since a
 * bar is only interesting once closed.
 *
 * @see https://www.interactivebrokers.com/docs/web-api/api-reference/trading/market-data
 */
export class IbkrMarketData extends MarketDataSource {
  /**
   * Every bar size IBKR serves. `1m` is one month, which is why one minute is spelled `1min`.
   *
   * @see https://www.interactivebrokers.com/campus/ibkr-api-page/cpapi-v1/#hmds-historical-bars
   */
  static readonly BAR_SIZES: readonly {bar: string; millis: number}[] = [
    {bar: '1m', millis: ms('30d')},
    {bar: '1w', millis: ms('7d')},
    {bar: '1d', millis: ms('1d')},
    {bar: '8h', millis: ms('8h')},
    {bar: '4h', millis: ms('4h')},
    {bar: '3h', millis: ms('3h')},
    {bar: '2h', millis: ms('2h')},
    {bar: '1h', millis: ms('1h')},
    {bar: '30min', millis: ms('30m')},
    {bar: '15min', millis: ms('15m')},
    {bar: '10min', millis: ms('10m')},
    {bar: '5min', millis: ms('5m')},
    {bar: '3min', millis: ms('3m')},
    {bar: '2min', millis: ms('2m')},
    {bar: '1min', millis: ms('1m')},
  ];

  /** A poll any tighter than this would hammer the gateway without producing a new closed bar. */
  static readonly MIN_POLL_INTERVAL_MS = ms('15s');

  /**
   * The slowest a watcher polls, whatever the bar size. Polling once per interval would mean a
   * daily bar is noticed up to a day after it closed, which is useless to a strategy waiting on
   * it; the gateway is a local process, so a minute between requests costs nothing.
   */
  static readonly MAX_POLL_INTERVAL_MS = ms('1m');

  readonly #api: IbkrAPI;
  readonly #conids: IbkrConidResolver;
  readonly #watchers = new Map<string, NodeJS.Timeout[]>();

  constructor(options?: {api?: IbkrAPI; conids?: IbkrConidResolver; gatewayUrl?: string | undefined}) {
    super();
    this.#api = options?.api ?? new IbkrAPI({gatewayUrl: options?.gatewayUrl});
    this.#conids = options?.conids ?? new IbkrConidResolver(this.#api);
  }

  /** The IBKR bar string for an interval, which must be one of its supported sizes. */
  static toBarSize(intervalInMillis: number): string {
    const match = IbkrMarketData.BAR_SIZES.find(size => size.millis === intervalInMillis);

    if (!match) {
      const supported = IbkrMarketData.BAR_SIZES.map(size => size.bar).join(', ');
      throw new Error(`IBKR has no bar size for an interval of ${intervalInMillis} ms. Supported: ${supported}.`);
    }

    return match.bar;
  }

  /**
   * IBKR anchors a history window at its end and takes the span as a `period` string, so a
   * start/end request becomes "this many days back from the end". Rounded up, and never below a
   * day, because a window shorter than one trading session still has to reach the last close.
   */
  static toPeriod(spanInMillis: number): string {
    const days = Math.max(1, Math.ceil(spanInMillis / ms('1d')));
    return `${days}d`;
  }

  /** IBKR's anchor format, `YYYYMMDD-HH:mm:ss` in UTC. */
  static toStartTime(date: Date): string {
    const [calendar, clock] = date.toISOString().split('T');
    return `${calendar?.replaceAll('-', '')}-${clock?.slice(0, 8)}`;
  }

  async getCandles(pair: TradingPair, request: CandleImportRequest): Promise<Candle[]> {
    const fromInMillis = new Date(request.startTimeFirstCandle).getTime();
    const toInMillis = new Date(request.startTimeLastCandle).getTime();

    /*
     * The anchor is pushed one interval past the window because IBKR drops any bar whose
     * `open + barLength` falls after `startTime`. A daily bar is stamped at the session open
     * (14:30 UTC for US equities), so an anchor of "now" hides the session that closed yesterday
     * evening. Bars beyond the caller's window are trimmed below.
     */
    const anchorInMillis = toInMillis + request.intervalInMillis;

    const bars = await this.#getBars(pair, request.intervalInMillis, {
      period: IbkrMarketData.toPeriod(anchorInMillis - fromInMillis),
      startTime: new Date(anchorInMillis),
    });

    /*
     * IBKR serves whole sessions, so a window that starts mid-session comes back with bars on
     * either side of it. The caller asked for a closed range of opening times.
     */
    return bars.filter(candle => candle.openTimeInMillis >= fromInMillis && candle.openTimeInMillis <= toInMillis);
  }

  /**
   * Whether a bar is still being built, and so must be withheld from a strategy.
   *
   * `open + interval <= now` is the obvious test and the one {@link MarketDataSource} applies, but
   * it is wrong for a daily bar: IBKR stamps it with the session open, so yesterday's closed
   * session only "finishes" 24 hours later and would be withheld for a whole trading day. A daily
   * bar belongs to a session instead, which for every exchange opens and closes on one UTC date.
   */
  static isForming(candle: Candle, intervalInMillis: number, nowInMillis: number): boolean {
    if (intervalInMillis === ms('1d')) {
      const day = (millis: number) => new Date(millis).toISOString().slice(0, 10);
      return day(candle.openTimeInMillis) === day(nowInMillis);
    }

    return candle.openTimeInMillis + intervalInMillis > nowInMillis;
  }

  /**
   * Overridden to ask IBKR for the newest bars outright. The inherited implementation walks
   * backwards in widening windows because it can only request time ranges, which costs several
   * round trips and stitches the result together; IBKR's `period` already means "this much
   * history, newest first".
   */
  override async getRecentCandles(pair: TradingPair, count: number, intervalInMillis: number): Promise<Candle[]> {
    if (count <= 0) {
      return [];
    }

    /*
     * Three times the span asked for, because `period` is wall-clock while `count` is in bars:
     * nights, weekends and holidays mean a window of `count` intervals holds far fewer bars.
     */
    const bars = await this.#getBars(pair, intervalInMillis, {
      period: IbkrMarketData.toPeriod(intervalInMillis * count * 3),
    });

    const now = Date.now();
    return bars.filter(candle => !IbkrMarketData.isForming(candle, intervalInMillis, now)).slice(-count);
  }

  protected override async getNewestCandles(pair: TradingPair, intervalInMillis: number): Promise<Candle[]> {
    /*
     * Three intervals of span, so the request still spans a closed bar and the one forming across
     * a weekend or a holiday, when the newest bar can be days old.
     */
    const bars = await this.#getBars(pair, intervalInMillis, {
      period: IbkrMarketData.toPeriod(intervalInMillis * 3),
    });

    if (bars.length === 0) {
      throw new Error(`IBKR returned no ${intervalInMillis} ms candles for ${pair.asString('/')}.`);
    }

    return bars;
  }

  /** @see {@link IbkrMarketData.isForming} */
  protected override isForming(candle: Candle, intervalInMillis: number, nowInMillis: number): boolean {
    return IbkrMarketData.isForming(candle, intervalInMillis, nowInMillis);
  }

  /**
   * Polls for closed bars and emits each one once, in order.
   *
   * Only bars opening at or after `openTimeInISO` are emitted, and the bar still forming is held
   * back until it closes, so a listener sees the same candles a backtest would.
   */
  async watchCandles(pair: TradingPair, intervalInMillis: number, openTimeInISO: string): Promise<string> {
    const topicId = randomUUID();
    const fromInMillis = new Date(openTimeInISO).getTime();
    let lastEmittedInMillis = fromInMillis - 1;

    const poll = async () => {
      const bars = await this.#getBars(pair, intervalInMillis, {
        period: IbkrMarketData.toPeriod(intervalInMillis * 2),
      });

      const now = Date.now();
      const fresh = bars
        .filter(candle => candle.openTimeInMillis > lastEmittedInMillis)
        .filter(candle => !IbkrMarketData.isForming(candle, intervalInMillis, now))
        .sort((left, right) => left.openTimeInMillis - right.openTimeInMillis);

      for (const candle of fresh) {
        lastEmittedInMillis = candle.openTimeInMillis;
        this.emit(topicId, candle);
      }
    };

    const pollIntervalMs = Math.min(
      IbkrMarketData.MAX_POLL_INTERVAL_MS,
      Math.max(IbkrMarketData.MIN_POLL_INTERVAL_MS, intervalInMillis)
    );

    /*
     * Chained rather than `setInterval`, so a tick never begins while the previous poll is still
     * awaiting `getHistory`. That call retries indefinitely by default, so with the gateway down
     * every overlapping tick would add another retry loop that `unwatchCandles` cannot reach, and
     * a transient error must not kill the timer or the feed stops silently.
     */
    const scheduleNext = () => {
      if (!this.#watchers.has(topicId)) {
        return;
      }
      this.#watchers.set(topicId, [
        setTimeout(
          () =>
            void poll()
              .catch(() => undefined)
              .finally(scheduleNext),
          pollIntervalMs
        ),
      ]);
    };

    /*
     * The first poll is scheduled rather than awaited, because a caller can only attach a listener
     * once it holds the topic id. Awaiting it here emitted the bars that had closed since
     * `openTimeInISO` into an empty emitter, losing them on every subscription.
     */
    this.#watchers.set(topicId, [
      setTimeout(
        () =>
          void poll()
            .catch(() => undefined)
            .finally(scheduleNext),
        0
      ),
    ]);

    return topicId;
  }

  unwatchCandles(topicId: string): void {
    for (const timer of this.#watchers.get(topicId) ?? []) {
      clearTimeout(timer);
    }
    this.#watchers.delete(topicId);

    this.removeAllListeners(topicId);
  }

  disconnect(): void {
    for (const timers of this.#watchers.values()) {
      for (const timer of timers) {
        clearTimeout(timer);
      }
    }
    this.#watchers.clear();
    this.removeAllListeners();
  }

  async #getBars(
    pair: TradingPair,
    intervalInMillis: number,
    window: {period: string; startTime?: Date}
  ): Promise<Candle[]> {
    const conid = await this.#conids.getConid(pair);
    const history = await this.#api.getHistory({
      bar: IbkrMarketData.toBarSize(intervalInMillis),
      conid,
      period: window.period,
      ...(window.startTime ? {startTime: IbkrMarketData.toStartTime(window.startTime)} : {}),
    });

    return (history.data ?? []).map(bar =>
      IbkrBrokerMapper.toCandle(bar, pair, intervalInMillis, history.volumeFactor ?? 1)
    );
  }
}
