import type {IndicatorSeries} from 'trading-signals';
import type {Candle} from '@typedtrader/exchange';
import type {PriceColumnKey} from './tableColumns';
import type {DemoIndicatorInput, DemoSignal, ProcessedIndicatorData} from './types';

interface ProcessDataOptions {
  /** Candle fields included in the row data (used by the table). */
  rowInputs: PriceColumnKey[];
  /** Candle fields passed to indicator.add(). Defaults to rowInputs. Single key passes a scalar; multiple keys pass an object. */
  addInputs?: PriceColumnKey[];
  /** Skip the isStable check and always call getResult(). */
  alwaysStable?: boolean;
}

/** Narrower than `DemoIndicator`: every indicator routed through here yields a single numeric result. */
type SeriesIndicator = Pick<IndicatorSeries, 'isStable' | 'getResult'> & {
  add(input: DemoIndicatorInput): unknown;
  getSignal?(): DemoSignal;
};

const candleField = (candle: Candle, key: PriceColumnKey) => Number(candle[key]);

export function makeProcessData(opts: ProcessDataOptions) {
  const addInputs = opts.addInputs ?? opts.rowInputs;
  return (indicator: SeriesIndicator, candle: Candle): ProcessedIndicatorData => {
    if (addInputs.length === 1) {
      indicator.add(candleField(candle, addInputs[0]));
    } else {
      const payload: Record<string, number> = {};
      for (const key of addInputs) {
        payload[key] = candleField(candle, key);
      }
      indicator.add(payload);
    }
    const result = opts.alwaysStable ? indicator.getResult() : indicator.isStable ? indicator.getResult() : null;
    const row: ProcessedIndicatorData = {result};
    for (const key of opts.rowInputs) {
      row[key] = candleField(candle, key);
    }
    if (indicator.getSignal) {
      row.signal = indicator.getSignal();
    }
    return row;
  };
}
