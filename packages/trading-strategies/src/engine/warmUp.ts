import {ms, type StringValue} from 'ms';
import type {Candle, MarketDataSource, TradingPair} from '@typedtrader/exchange';
import type {IndicatorHandle} from './types.js';

/**
 * Fetches the past bars every indicator declared and hands them over before the first live
 * candle, so a strategy whose settings come from history does not have to wait days of live
 * candles to learn them. Declarations asking for the same bars share one request.
 */
export async function warmUpFromHistory(options: {
  declarations: Record<string, {history?: {count: number; interval: StringValue} | undefined}>;
  handles: Map<string, IndicatorHandle<unknown>>;
  market: Pick<MarketDataSource, 'getRecentCandles'>;
  pair: TradingPair;
  report?: ((text: string) => void) | undefined;
}): Promise<void> {
  const {declarations, handles, market, pair, report} = options;

  const requests = new Map<string, {count: number; handles: IndicatorHandle<unknown>[]; interval: StringValue}>();

  for (const [name, declaration] of Object.entries(declarations)) {
    const {history} = declaration;
    const handle = handles.get(name);
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
      report?.(`Could not load ${count} bars of ${interval} history: ${String(error)}`);
      continue;
    }
    /*
     * An empty answer is not an error, and it is not nothing either: a setting that comes from
     * history falls back to whatever the config says, which for a strategy that refuses to trade
     * on the wrong instrument means the refusal never gets a chance to apply. Said out loud, so
     * that a backtest on a dataset with no run-up, or a broker serving no bars, is not read as a
     * strategy that judged the instrument and approved it.
     */
    if (candles.length === 0) {
      report?.(`No ${interval} history available, so settings derived from it fall back to the configuration`);
    }

    for (const handle of handles) {
      handle.warmUp?.(candles);
    }
  }
}
