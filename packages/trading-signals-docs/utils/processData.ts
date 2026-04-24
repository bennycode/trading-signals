import type {ExchangeCandle} from '@typedtrader/exchange';
import type {PriceColumnKey} from './tableColumns';
import type {IndicatorConfig} from './types';

interface ProcessDataOptions {
  /** Candle fields included in the row data (used by the table). */
  rowInputs: PriceColumnKey[];
  /** Candle fields passed to indicator.add(). Defaults to rowInputs. Single key passes a scalar; multiple keys pass an object. */
  addInputs?: PriceColumnKey[];
  /** 'required' calls indicator.getSignal() unconditionally; 'optional' guards with `'getSignal' in indicator`. */
  signal?: 'required' | 'optional' | 'none';
  /** Skip the isStable check and always call getResult(). */
  alwaysStable?: boolean;
}

const candleField = (candle: ExchangeCandle, key: PriceColumnKey) => Number(candle[key]);

export function makeProcessData(opts: ProcessDataOptions): IndicatorConfig['processData'] {
  const addInputs = opts.addInputs ?? opts.rowInputs;
  return (indicator, candle) => {
    if (addInputs.length === 1) {
      indicator.add(candleField(candle, addInputs[0]));
    } else {
      const payload: Record<string, number> = {};
      for (const key of addInputs) payload[key] = candleField(candle, key);
      indicator.add(payload);
    }
    const result = opts.alwaysStable
      ? indicator.getResult()
      : indicator.isStable
        ? indicator.getResult()
        : null;
    const row: Record<string, unknown> = {result};
    for (const key of opts.rowInputs) row[key] = candleField(candle, key);
    if (opts.signal === 'required') {
      row.signal = indicator.getSignal();
    } else if (opts.signal === 'optional') {
      row.signal = 'getSignal' in indicator ? indicator.getSignal() : {state: 'UNKNOWN', hasChanged: false};
    }
    return row;
  };
}
