import type {ReactNode} from 'react';
import type {Candle} from '@typedtrader/exchange';
import {formatDate} from './formatDate';
import type {SingleIndicatorConfig} from './types';
import type {PriceData} from '../components/PriceChart';
import type {ChartDataPoint} from '../components/Chart';
import Chart from '../components/Chart';
import PriceChart from '../components/PriceChart';
import {DataTable} from '../components/DataTable';
import {IndicatorHeader} from '../components/IndicatorHeader';
import {NotAvailable} from '../components/NotAvailable';

export const collectPriceData = (candle: Candle, idx: number): PriceData => ({
  close: Number(candle.close),
  high: Number(candle.high),
  low: Number(candle.low),
  open: Number(candle.open),
  x: idx + 1,
});

export const renderSingleIndicator = (config: SingleIndicatorConfig, selectedCandles: Candle[]) => {
  const indicator = config.createIndicator();
  const chartData: ChartDataPoint[] = [];
  const priceData: PriceData[] = [];
  const sampleValues: {
    period: number;
    date: string;
    result: ReactNode;
    signal?: string;
    [key: string]: any;
  }[] = [];

  selectedCandles.forEach((candle, idx) => {
    const processedData = config.processData(indicator, candle, idx);
    const chartPoint = config.getChartData
      ? config.getChartData(processedData)
      : {x: idx + 1, y: (processedData.result as number | null) ?? null};

    if (Array.isArray(chartPoint)) {
      chartData.push(...chartPoint);
    } else {
      chartData.push({x: idx + 1, y: chartPoint.y});
    }

    priceData.push(collectPriceData(candle, idx));

    /*
     * processData returns an intentionally dynamic shape (TResult defaults to any so each indicator can
     * return its own fields), and the sampleValues row already allows arbitrary keys via its index
     * signature — so spreading it is unavoidably "unsafe" by the linter's reckoning.
     */
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
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

  return (
    <div className="space-y-6">
      <IndicatorHeader
        name={config.name}
        parameters={`${indicator.interval || config.requiredInputs}`}
        requiredInputs={config.requiredInputs}
        description={config.description}
        details={config.details}
      />

      <Chart title={config.chartTitle} data={chartData} yAxisLabel={config.yAxisLabel} color={config.color} />

      <PriceChart title="Input Prices" data={priceData} />

      <DataTable title="All Sample Values" columns={config.getTableColumns(indicator)} data={sampleValues} />
    </div>
  );
};
