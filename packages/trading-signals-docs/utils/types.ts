import type {ReactElement, ReactNode} from 'react';
import type {TechnicalIndicator, TrendIndicatorSeries} from 'trading-signals';
import type {ChartDataPoint} from '../components/Chart';
import type {Candle} from '@typedtrader/exchange';

export interface ColumnDef {
  header: string;
  key: string;
  render?: (val: unknown, row?: Record<string, unknown>) => ReactNode;
  className?: string;
}

/** Scalar for single-value indicators, keyed bar values for OHLC-style ones. */
export type DemoIndicatorInput = number | Record<string, number>;

/** Signal shape shared by every signal-capable `trading-signals` indicator. */
export type DemoSignal = ReturnType<TrendIndicatorSeries['getSignal']>;

/**
 * What the generic demo plumbing relies on from a `trading-signals` indicator, derived from the
 * library's own contracts. `add` stays a locally declared method so indicators with narrower
 * input types remain assignable. Result and input shapes differ per indicator, so a config that
 * reads them parameterizes `IndicatorConfig<TIndicator>`.
 */
export type DemoIndicator = Pick<TechnicalIndicator<unknown, never>, 'isStable' | 'getResult'> & {
  interval?: number;
  add(input: DemoIndicatorInput): unknown;
  getSignal?(): DemoSignal;
};

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
