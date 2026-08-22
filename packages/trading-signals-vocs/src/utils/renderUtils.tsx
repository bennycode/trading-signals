import type {ReactNode} from 'react';
import type {Candle} from '@typedtrader/exchange';
import {formatDate} from './formatDate';
import type {ProcessedIndicatorData, SingleIndicatorConfig} from './types';
import type {PriceData} from '../components/PriceChart';
import type {ChartDataPoint} from '../components/Chart';
import Chart from '../components/Chart';
import PriceChart from '../components/PriceChart';
import {DataTable} from '../components/DataTable';
import {NotAvailable} from '../components/NotAvailable';

export const collectPriceData = (candle: Candle, idx: number): PriceData => ({
  close: Number(candle.close),
  high: Number(candle.high),
  low: Number(candle.low),
  open: Number(candle.open),
  x: idx + 1,
});

/** The demo split into sections so the page layout can place them individually. */
export interface SingleIndicatorView {
  /** Main indicator chart without a card wrapper, for embedding next to the dataset selector. */
  chart: ReactNode;
  priceChart: ReactNode;
  table: ReactNode;
}

export const buildSingleIndicatorView = (
  config: SingleIndicatorConfig,
  selectedCandles: Candle[]
): SingleIndicatorView => {
  const indicator = config.createIndicator();
  const chartData: ChartDataPoint[] = [];
  const priceData: PriceData[] = [];
  const sampleValues: {
    period: number;
    date: string;
    result: ReactNode;
    signal?: string;
    [key: string]: unknown;
  }[] = [];

  selectedCandles.forEach((candle, idx) => {
    const processedData: ProcessedIndicatorData = config.processData(indicator, candle, idx);
    const chartPoint = config.getChartData
      ? config.getChartData(processedData)
      : {x: idx + 1, y: processedData.result ?? null};

    if (Array.isArray(chartPoint)) {
      chartData.push(...chartPoint);
    } else {
      chartData.push({x: idx + 1, y: chartPoint.y});
    }

    priceData.push(collectPriceData(candle, idx));

    sampleValues.push({
      date: formatDate(candle.openTimeInISO),
      period: idx + 1,
      ...processedData,
      result:
        processedData.result !== null && processedData.result !== undefined ? (
          processedData.result.toFixed(2)
        ) : (
          <NotAvailable />
        ),
      signal: processedData.signal?.state,
    });
  });

  return {
    chart: (
      <Chart bare title={config.chartTitle} data={chartData} yAxisLabel={config.yAxisLabel} color={config.color} />
    ),
    priceChart: <PriceChart title="Input Prices" data={priceData} />,
    table: <DataTable title="All Sample Values" columns={config.getTableColumns(indicator)} data={sampleValues} />,
  };
};
