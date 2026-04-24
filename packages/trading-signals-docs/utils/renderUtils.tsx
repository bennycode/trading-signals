import type {ReactNode} from 'react';
import type {ExchangeCandle} from '@typedtrader/exchange';
import {formatDate} from './formatDate';
import type {IndicatorConfig} from './types';
import type {PriceData} from '../components/PriceChart';
import type {ChartDataPoint} from '../components/Chart';
import Chart from '../components/Chart';
import PriceChart from '../components/PriceChart';
import {DataTable} from '../components/DataTable';
import {IndicatorHeader} from '../components/IndicatorHeader';
import {NotAvailable} from '../components/NotAvailable';

export const collectPriceData = (candle: ExchangeCandle, idx: number): PriceData => ({
  x: idx + 1,
  open: Number(candle.open),
  high: Number(candle.high),
  low: Number(candle.low),
  close: Number(candle.close),
});

export const renderSingleIndicator = (config: IndicatorConfig, selectedCandles: ExchangeCandle[]) => {
  const indicator = config.createIndicator!();
  const chartData: ChartDataPoint[] = [];
  const priceData: PriceData[] = [];
  const sampleValues: Array<{
    period: number;
    date: string;
    result: ReactNode;
    signal?: string;
    [key: string]: any;
  }> = [];

  selectedCandles.forEach((candle, idx) => {
    const processedData = config.processData!(indicator, candle, idx);
    const chartPoint = config.getChartData
      ? config.getChartData(processedData)
      : {x: idx + 1, y: (processedData.result as number | null) ?? null};

    if (Array.isArray(chartPoint)) {
      chartData.push(...chartPoint);
    } else {
      chartData.push({x: idx + 1, y: chartPoint.y});
    }

    priceData.push(collectPriceData(candle, idx));

    sampleValues.push({
      period: idx + 1,
      date: formatDate(candle.openTimeInISO),
      ...processedData,
      result:
        processedData.result !== null && processedData.result !== undefined ? processedData.result.toFixed(2) : <NotAvailable />,
      signal: processedData.signal?.state,
    });
  });

  return (
    <div className="space-y-6">
      <IndicatorHeader
        name={config.name}
        parameters={`${indicator.interval || config.requiredInputs}`}
        requiredInputs={config.requiredInputs}
        description={config.description}
        details={config.details}
      />

      <Chart title={config.chartTitle!} data={chartData} yAxisLabel={config.yAxisLabel!} color={config.color} />

      <PriceChart title="Input Prices" data={priceData} />

      <DataTable title="All Sample Values" columns={config.getTableColumns?.(indicator) ?? []} data={sampleValues} />
    </div>
  );
};
