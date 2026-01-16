import type {Candle, IndicatorConfig} from './types';
import type {PriceData} from '../../components/PriceChart';
import type {ChartDataPoint} from '../../components/Chart';
import Chart from '../../components/Chart';
import PriceChart from '../../components/PriceChart';
import {DataTable} from '../../components/DataTable';
import {IndicatorHeader} from '../../components/IndicatorHeader';

export const collectPriceData = (candle: Candle, idx: number): PriceData => ({
  x: idx + 1,
  open: candle.open,
  high: candle.high,
  low: candle.low,
  close: candle.close,
});

export const renderSingleIndicator = (config: IndicatorConfig, selectedCandles: Candle[]) => {
  const indicator = config.createIndicator!();
  const chartData: ChartDataPoint[] = [];
  const priceData: PriceData[] = [];
  const sampleValues: any[] = [];

  selectedCandles.forEach((candle, idx) => {
    const processedData = config.processData!(indicator, candle, idx);
    const chartPoint = config.getChartData!(processedData);

    if (Array.isArray(chartPoint)) {
      chartData.push(...chartPoint);
    } else {
      chartData.push({x: idx + 1, y: chartPoint.y});
    }

    priceData.push(collectPriceData(candle, idx));

    sampleValues.push({
      period: idx + 1,
      date: candle.date,
      ...processedData,
      result:
        processedData.result !== null && processedData.result !== undefined ? processedData.result.toFixed(2) : 'N/A',
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

      <DataTable title="All Sample Values" columns={config.getTableColumns!()} data={sampleValues} />
    </div>
  );
};
