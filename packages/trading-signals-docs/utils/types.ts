import type React from 'react';
import type {ChartDataPoint} from '../components/Chart';
import type {ExchangeCandle} from '@typedtrader/exchange';

export interface ColumnDef {
  header: string;
  key: string;
  render?: (val: any, row?: any) => any;
  className?: string;
}

interface BaseIndicatorConfig<TIndicator = any> {
  id: string;
  name: string;
  description: string;
  color: string;
  requiredInputs: number;
  details?: string;
  createIndicator: () => TIndicator;
}

export interface SingleIndicatorConfig<TIndicator = any, TResult = any> extends BaseIndicatorConfig<TIndicator> {
  type: 'single';
  processData: (indicator: TIndicator, candle: ExchangeCandle, idx: number) => TResult;
  getChartData?: (result: TResult) => ChartDataPoint | ChartDataPoint[];
  getTableColumns: (indicator: TIndicator) => ColumnDef[];
  chartTitle: string;
  yAxisLabel: string;
}

export interface CustomIndicatorConfig<TIndicator = any> extends BaseIndicatorConfig<TIndicator> {
  type: 'custom';
  customRender: (config: CustomIndicatorConfig<TIndicator>, selectedCandles: ExchangeCandle[]) => React.ReactElement;
}

export type IndicatorConfig<TIndicator = any, TResult = any> =
  | SingleIndicatorConfig<TIndicator, TResult>
  | CustomIndicatorConfig<TIndicator>;

export interface CandleDataset {
  id: string;
  name: string;
  description: string;
  candles: ExchangeCandle[];
}
