import {SignalBadge} from '../components/SignalBadge';
import type {ColumnDef} from './types';

export type PriceColumnKey = 'open' | 'high' | 'low' | 'close' | 'volume';

const priceColumns: Record<PriceColumnKey, ColumnDef> = {
  open: {header: 'Open', key: 'open', render: val => `$${val.toFixed(2)}`, className: 'text-slate-300 py-2 px-3'},
  high: {header: 'High', key: 'high', render: val => `$${val.toFixed(2)}`, className: 'text-slate-300 py-2 px-3'},
  low: {header: 'Low', key: 'low', render: val => `$${val.toFixed(2)}`, className: 'text-slate-300 py-2 px-3'},
  close: {header: 'Close', key: 'close', render: val => `$${val.toFixed(2)}`, className: 'text-slate-300 py-2 px-3'},
  volume: {header: 'Volume', key: 'volume', className: 'text-slate-300 py-2 px-3'},
};

interface BuildOptions {
  inputs: PriceColumnKey[];
  indicator: unknown;
  extra?: ColumnDef[];
}

export function buildTableColumns({inputs, indicator, extra = []}: BuildOptions): ColumnDef[] {
  const cols: ColumnDef[] = [
    {header: 'Period', key: 'period'},
    {header: 'Date', key: 'date'},
    ...inputs.map(key => priceColumns[key]),
    {header: 'Result', key: 'result', className: 'text-white font-mono py-2 px-3'},
    ...extra,
  ];
  if (indicator && typeof indicator === 'object' && 'getSignal' in indicator) {
    cols.push({
      header: 'Signal',
      key: 'signal',
      render: val => <SignalBadge signal={val} />,
      className: 'py-2 px-3',
    });
  }
  return cols;
}
