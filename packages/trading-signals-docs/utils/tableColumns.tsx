import {SignalBadge} from '../components/SignalBadge';
import type {ColumnDef} from './types';

export type PriceColumnKey = 'open' | 'high' | 'low' | 'close' | 'volume';

const formatUsd = (val: unknown) => (typeof val === 'number' ? `$${val.toFixed(2)}` : String(val));

const priceColumns: Record<PriceColumnKey, ColumnDef> = {
  close: {className: 'text-slate-300 py-2 px-3', header: 'Close', key: 'close', render: formatUsd},
  high: {className: 'text-slate-300 py-2 px-3', header: 'High', key: 'high', render: formatUsd},
  low: {className: 'text-slate-300 py-2 px-3', header: 'Low', key: 'low', render: formatUsd},
  open: {className: 'text-slate-300 py-2 px-3', header: 'Open', key: 'open', render: formatUsd},
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
      render: val => <SignalBadge signal={typeof val === 'string' ? val : 'UNKNOWN'} />,
    });
  }
  return cols;
}
