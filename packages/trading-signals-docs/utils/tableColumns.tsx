import {SignalBadge} from '../components/SignalBadge';
import type {ColumnDef} from './types';

export type PriceColumnKey = 'open' | 'high' | 'low' | 'close' | 'volume';

const priceColumns: Record<PriceColumnKey, ColumnDef> = {
  close: {className: 'text-slate-300 py-2 px-3', header: 'Close', key: 'close', render: val => `$${val.toFixed(2)}`},
  high: {className: 'text-slate-300 py-2 px-3', header: 'High', key: 'high', render: val => `$${val.toFixed(2)}`},
  low: {className: 'text-slate-300 py-2 px-3', header: 'Low', key: 'low', render: val => `$${val.toFixed(2)}`},
  open: {className: 'text-slate-300 py-2 px-3', header: 'Open', key: 'open', render: val => `$${val.toFixed(2)}`},
  volume: {className: 'text-slate-300 py-2 px-3', header: 'Volume', key: 'volume'},
};

interface BuildOptions {
  inputs: PriceColumnKey[];
  indicator: unknown;
  extra?: ColumnDef[];
}

export function buildTableColumns({extra = [], indicator, inputs}: BuildOptions): ColumnDef[] {
  const cols: ColumnDef[] = [
    {header: 'Period', key: 'period'},
    {header: 'Date', key: 'date'},
    ...inputs.map(key => priceColumns[key]),
    {className: 'text-white font-mono py-2 px-3', header: 'Result', key: 'result'},
    ...extra,
  ];
  if (indicator && typeof indicator === 'object' && 'getSignal' in indicator) {
    cols.push({
      className: 'py-2 px-3',
      header: 'Signal',
      key: 'signal',
      render: val => <SignalBadge signal={val} />,
    });
  }
  return cols;
}
