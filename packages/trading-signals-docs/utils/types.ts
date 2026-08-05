import type {ReactElement, ReactNode} from 'react';
import type {ChartDataPoint} from '../components/Chart';
import type {Candle} from '@typedtrader/exchange';

export interface ColumnDef {
  header: string;
  key: string;
  render?: (val: unknown, row?: Record<string, unknown>) => ReactNode;
  className?: string;
}

/**
 * What the generic demo plumbing relies on from a `trading-signals` indicator. Result and input
 * shapes differ per indicator, so a config that reads them parameterizes `IndicatorConfig<TIndicator>`.
 */
export interface DemoIndicator {
  isStable: boolean;
  interval?: number;
  add(input: number | Record<string, number>): unknown;
  getResult(): unknown;
  getSignal?(): {state: string; hasChanged: boolean};
}

/** Shape shared by every demo's `processData` result — extra indicator-specific keys pass through to the sample table. */
export interface ProcessedIndicatorData {
  result?: number | null;
  signal?: {state?: string};
  [key: string]: unknown;
}

interface BaseIndicatorConfig<TIndicator = DemoIndicator> {
  id: string;
  name: string;
  description: string;
  color: string;
  requiredInputs: number;
  details?: string;
  createIndicator: () => TIndicator;
}

export interface SingleIndicatorConfig<
  TIndicator = DemoIndicator,
  TResult extends ProcessedIndicatorData = ProcessedIndicatorData,
> extends BaseIndicatorConfig<TIndicator> {
  type: 'single';
  /*
   * Method syntax on purpose: methods are checked bivariantly, so a concretely typed config
   * (e.g. `IndicatorConfig<LinearRegression>`) still fits registries typed as plain `IndicatorConfig`.
   */
  processData(indicator: TIndicator, candle: Candle, idx: number): TResult;
  getChartData?(result: TResult): ChartDataPoint | ChartDataPoint[];
  getTableColumns(indicator: TIndicator): ColumnDef[];
  chartTitle: string;
  yAxisLabel: string;
}

export interface CustomIndicatorConfig<TIndicator = DemoIndicator> extends BaseIndicatorConfig<TIndicator> {
  type: 'custom';
  customRender: (config: CustomIndicatorConfig<TIndicator>, selectedCandles: Candle[]) => ReactElement;
}

export type IndicatorConfig<
  TIndicator = DemoIndicator,
  TResult extends ProcessedIndicatorData = ProcessedIndicatorData,
> = SingleIndicatorConfig<TIndicator, TResult> | CustomIndicatorConfig<TIndicator>;

export interface CandleDataset {
  id: string;
  name: string;
  description: string;
  candles: Candle[];
}
