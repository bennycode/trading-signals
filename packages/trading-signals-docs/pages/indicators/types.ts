import type {ReactElement} from 'react';
import type {ChartDataPoint} from '../../components/Chart';

export type IndicatorType = 'single' | 'dual' | 'triple' | 'custom';

export interface ColumnDef {
  header: string;
  key: string;
  render?: (val: any, row?: any) => any;
  className?: string;
}

export interface Candle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface IndicatorConfig<TIndicator = any, TResult = any> {
  id: string;
  name: string;
  description: string;
  color: string;
  requiredInputs: number;
  type: IndicatorType;
  details?: string;
  createIndicator: () => TIndicator;
  processData: (indicator: TIndicator, candle: Candle, idx: number) => TResult;
  getChartData: (result: TResult) => ChartDataPoint | ChartDataPoint[];
  getTableColumns: () => ColumnDef[];
  chartTitle?: string;
  yAxisLabel?: string;
  customRender?: (config: IndicatorConfig<TIndicator, TResult>) => ReactElement;
}

export interface CandleDataset {
  id: string;
  name: string;
  description: string;
  candles: Candle[];
}
