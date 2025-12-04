import {useEffect, useState} from 'react';
import {Chart as HighchartsChart} from '@highcharts/react';
import {
  AC,
  AO,
  CCI,
  CG,
  EMA,
  MACD,
  MOM,
  OBV,
  REI,
  ROC,
  RSI,
  StochasticOscillator,
  StochasticRSI,
  TDS,
  WilliamsR,
} from 'trading-signals';
import Chart, {ChartDataPoint} from '../../components/Chart';
import {DataTable} from '../../components/DataTable';
import {IndicatorHeader} from '../../components/IndicatorHeader';
import {SignalBadge} from '../../components/SignalBadge';

type IndicatorType = 'single' | 'dual' | 'triple' | 'custom';

interface ColumnDef {
  header: string;
  key: string;
  render?: (val: any, row?: any) => any;
  className?: string;
}

interface Candle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface IndicatorConfig<TIndicator = any, TResult = any> {
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
  customRender?: (config: IndicatorConfig<TIndicator, TResult>) => React.ReactElement;
}

// OHLCV data (from Ethereum)
const ethCandles: Candle[] = [
  {date: '09/11/2025', open: 2318.45, high: 2345.67, low: 2298.12, close: 2334.89, volume: 4567890},
  {date: '09/12/2025', open: 2334.89, high: 2389.23, low: 2315.67, close: 2378.45, volume: 5234567},
  {date: '09/13/2025', open: 2378.45, high: 2398.76, low: 2356.34, close: 2367.89, volume: 4890123},
  {date: '09/14/2025', open: 2367.89, high: 2401.23, low: 2348.56, close: 2395.12, volume: 5123456},
  {date: '09/15/2025', open: 2395.12, high: 2445.67, low: 2388.9, close: 2432.56, volume: 6234567},
  {date: '09/16/2025', open: 2432.56, high: 2468.34, low: 2415.23, close: 2456.78, volume: 5890123},
  {date: '09/17/2025', open: 2456.78, high: 2489.12, low: 2441.56, close: 2478.34, volume: 5567890},
  {date: '09/18/2025', open: 2478.34, high: 2512.45, low: 2465.89, close: 2498.67, volume: 6123456},
  {date: '09/19/2025', open: 2498.67, high: 2534.23, low: 2487.56, close: 2523.45, volume: 6890123},
  {date: '09/20/2025', open: 2523.45, high: 2556.78, low: 2510.12, close: 2545.89, volume: 7234567},
  {date: '09/21/2025', open: 2545.89, high: 2578.34, low: 2532.67, close: 2567.12, volume: 6567890},
  {date: '09/22/2025', open: 2567.12, high: 2589.45, low: 2548.23, close: 2574.56, volume: 5890123},
  {date: '09/23/2025', open: 2574.56, high: 2598.67, low: 2556.78, close: 2589.34, volume: 6123456},
  {date: '09/24/2025', open: 2589.34, high: 2612.89, low: 2578.45, close: 2601.23, volume: 6456789},
  {date: '09/25/2025', open: 2601.23, high: 2634.56, low: 2587.9, close: 2623.45, volume: 7123456},
  {date: '09/26/2025', open: 2623.45, high: 2656.78, low: 2612.34, close: 2645.67, volume: 7890123},
  {date: '09/27/2025', open: 2645.67, high: 2678.9, low: 2634.23, close: 2667.89, volume: 8234567},
  {date: '09/28/2025', open: 2667.89, high: 2689.12, low: 2651.45, close: 2678.34, volume: 7567890},
  {date: '09/29/2025', open: 2678.34, high: 2698.56, low: 2665.78, close: 2689.23, volume: 6890123},
  {date: '09/30/2025', open: 2689.23, high: 2712.45, low: 2676.89, close: 2701.56, volume: 7234567},
  {date: '10/01/2025', open: 2701.56, high: 2734.67, low: 2689.34, close: 2723.45, volume: 7890123},
  {date: '10/02/2025', open: 2723.45, high: 2756.89, low: 2712.78, close: 2745.67, volume: 8567890},
  {date: '10/03/2025', open: 2745.67, high: 2778.34, low: 2734.56, close: 2767.89, volume: 9123456},
  {date: '10/04/2025', open: 2767.89, high: 2798.45, low: 2756.23, close: 2789.12, volume: 8890123},
  {date: '10/05/2025', open: 2789.12, high: 2823.56, low: 2778.67, close: 2812.34, volume: 9234567},
  {date: '10/06/2025', open: 2812.34, high: 2845.78, low: 2801.45, close: 2834.56, volume: 9567890},
  {date: '10/07/2025', open: 2834.56, high: 2867.23, low: 2823.89, close: 2856.78, volume: 10123456},
  {date: '10/08/2025', open: 2856.78, high: 2889.45, low: 2845.67, close: 2878.9, volume: 10567890},
  {date: '10/09/2025', open: 2878.9, high: 2912.34, low: 2867.56, close: 2901.23, volume: 11234567},
  {date: '10/10/2025', open: 2901.23, high: 2934.67, low: 2889.78, close: 2923.45, volume: 10890123},
  {date: '10/11/2025', open: 2923.45, high: 2956.89, low: 2912.34, close: 2945.67, volume: 11567890},
  {date: '10/12/2025', open: 2945.67, high: 2978.23, low: 2934.56, close: 2967.89, volume: 12123456},
  {date: '10/13/2025', open: 2967.89, high: 2989.45, low: 2956.78, close: 2978.34, volume: 11234567},
  {date: '10/14/2025', open: 2978.34, high: 3012.56, low: 2967.9, close: 3001.23, volume: 12890123},
  {date: '10/15/2025', open: 3001.23, high: 3034.78, low: 2989.67, close: 3023.45, volume: 13567890},
  {date: '10/16/2025', open: 3023.45, high: 3056.34, low: 3012.89, close: 3045.67, volume: 14123456},
  {date: '10/17/2025', open: 3045.67, high: 3078.9, low: 3034.56, close: 3067.89, volume: 13890123},
  {date: '10/18/2025', open: 3067.89, high: 3089.23, low: 3056.78, close: 3078.45, volume: 12567890},
  {date: '10/19/2025', open: 3078.45, high: 3098.67, low: 3067.34, close: 3089.56, volume: 11890123},
  {date: '10/20/2025', open: 3089.56, high: 3112.34, low: 3078.9, close: 3101.23, volume: 12234567},
];

const indicators: IndicatorConfig[] = [
  {
    id: 'rsi',
    name: 'RSI',
    description: 'Relative Strength Index',
    color: '#8b5cf6',
    type: 'single',
    requiredInputs: 14,
    details:
      'RSI measures the magnitude of recent price changes to evaluate overbought or oversold conditions. Values above 70 indicate overbought, below 30 indicate oversold.',
    createIndicator: () => new RSI(14),
    processData: (indicator, candle) => {
      indicator.add(candle.close);
      const result = indicator.isStable ? indicator.getResult() : null;
      const signal = indicator.getSignal();
      return {result, signal, close: candle.close};
    },
    getChartData: result => ({x: 0, y: result.result}),
    getTableColumns: () => [
      {header: 'Period', key: 'period'},
      {header: 'Date', key: 'date'},
      {header: 'Close', key: 'close', render: val => `$${val.toFixed(2)}`, className: 'text-slate-300 py-2 px-3'},
      {header: 'RSI', key: 'result', className: 'text-white font-mono py-2 px-3'},
      {header: 'Signal', key: 'signal', render: val => <SignalBadge signal={val} />, className: 'py-2 px-3'},
    ],
    chartTitle: 'RSI (14)',
    yAxisLabel: 'RSI',
  },
  {
    id: 'stoch',
    name: 'Stochastic',
    description: 'Stochastic Oscillator',
    color: '#ec4899',
    type: 'custom',
    requiredInputs: 17,
    createIndicator: () => new StochasticOscillator(14, 3, 3),
    processData: () => ({}),
    getChartData: () => ({x: 0, y: null}),
    getTableColumns: () => [],
  },
  {
    id: 'cci',
    name: 'CCI',
    description: 'Commodity Channel Index',
    color: '#f59e0b',
    type: 'single',
    requiredInputs: 20,
    details:
      'Measures deviation from the average price. Readings above +100 suggest overbought, below -100 suggest oversold.',
    createIndicator: () => new CCI(20),
    processData: (indicator, candle) => {
      indicator.add({high: candle.high, low: candle.low, close: candle.close});
      const result = indicator.isStable ? indicator.getResult() : null;
      const signal = indicator.getSignal();
      return {result, signal, close: candle.close};
    },
    getChartData: result => ({x: 0, y: result.result}),
    getTableColumns: () => [
      {header: 'Period', key: 'period'},
      {header: 'Date', key: 'date'},
      {header: 'Close', key: 'close', render: val => `$${val.toFixed(2)}`, className: 'text-slate-300 py-2 px-3'},
      {header: 'CCI', key: 'result', className: 'text-white font-mono py-2 px-3'},
      {header: 'Signal', key: 'signal', render: val => <SignalBadge signal={val} />, className: 'py-2 px-3'},
    ],
    chartTitle: 'CCI (20)',
    yAxisLabel: 'CCI',
  },
  {
    id: 'roc',
    name: 'ROC',
    description: 'Rate of Change',
    color: '#10b981',
    type: 'single',
    requiredInputs: 9,
    details:
      'Measures the percentage change in price from n periods ago. Positive values indicate upward momentum, negative values indicate downward momentum.',
    createIndicator: () => new ROC(9),
    processData: (indicator, candle) => {
      indicator.add(candle.close);
      const result = indicator.isStable ? indicator.getResult() : null;
      const signal = indicator.getSignal();
      return {result, signal, close: candle.close};
    },
    getChartData: result => ({x: 0, y: result.result}),
    getTableColumns: () => [
      {header: 'Period', key: 'period'},
      {header: 'Date', key: 'date'},
      {header: 'Close', key: 'close', render: val => `$${val.toFixed(2)}`, className: 'text-slate-300 py-2 px-3'},
      {header: 'ROC %', key: 'result', className: 'text-white font-mono py-2 px-3'},
      {header: 'Signal', key: 'signal', render: val => <SignalBadge signal={val} />, className: 'py-2 px-3'},
    ],
    chartTitle: 'ROC (9)',
    yAxisLabel: 'ROC %',
  },
  {
    id: 'macd',
    name: 'MACD',
    description: 'Moving Average Convergence Divergence',
    color: '#3b82f6',
    type: 'custom',
    requiredInputs: 33,
    createIndicator: () => new MACD(new EMA(12), new EMA(26), new EMA(9)),
    processData: () => ({}),
    getChartData: () => ({x: 0, y: null}),
    getTableColumns: () => [],
  },
  {
    id: 'ao',
    name: 'AO',
    description: 'Awesome Oscillator',
    color: '#06b6d4',
    type: 'single',
    requiredInputs: 34,
    details:
      "Measures market momentum using the difference between a 5-period and 34-period simple moving average of the bar's midpoints.",
    createIndicator: () => new AO(5, 34),
    processData: (indicator, candle) => {
      indicator.add(candle);
      const result = indicator.isStable ? indicator.getResult() : null;
      const signal = indicator.getSignal();
      return {result, signal, high: candle.high, low: candle.low};
    },
    getChartData: result => ({x: 0, y: result.result}),
    getTableColumns: () => [
      {header: 'Period', key: 'period'},
      {header: 'Date', key: 'date'},
      {header: 'High', key: 'high', render: val => `$${val.toFixed(2)}`, className: 'text-slate-300 py-2 px-3'},
      {header: 'Low', key: 'low', render: val => `$${val.toFixed(2)}`, className: 'text-slate-300 py-2 px-3'},
      {header: 'AO', key: 'result', className: 'text-white font-mono py-2 px-3'},
      {header: 'Signal', key: 'signal', render: val => <SignalBadge signal={val} />, className: 'py-2 px-3'},
    ],
    chartTitle: 'Awesome Oscillator (5,34)',
    yAxisLabel: 'AO',
  },
  {
    id: 'ac',
    name: 'AC',
    description: 'Accelerator Oscillator',
    color: '#6366f1',
    type: 'single',
    requiredInputs: 39,
    details:
      'Shows acceleration or deceleration of the current driving force. Earlier signal of potential trend change than AO.',
    createIndicator: () => new AC(5, 34, 5),
    processData: (indicator, candle) => {
      indicator.add(candle);
      const result = indicator.isStable ? indicator.getResult() : null;
      const signal = indicator.getSignal();
      return {result, signal, high: candle.high, low: candle.low};
    },
    getChartData: result => ({x: 0, y: result.result}),
    getTableColumns: () => [
      {header: 'Period', key: 'period'},
      {header: 'Date', key: 'date'},
      {header: 'High', key: 'high', render: val => `$${val.toFixed(2)}`, className: 'text-slate-300 py-2 px-3'},
      {header: 'Low', key: 'low', render: val => `$${val.toFixed(2)}`, className: 'text-slate-300 py-2 px-3'},
      {header: 'AC', key: 'result', className: 'text-white font-mono py-2 px-3'},
      {header: 'Signal', key: 'signal', render: val => <SignalBadge signal={val} />, className: 'py-2 px-3'},
    ],
    chartTitle: 'Accelerator Oscillator (5,34,5)',
    yAxisLabel: 'AC',
  },
  {
    id: 'cg',
    name: 'CG',
    description: 'Center of Gravity',
    color: '#f97316',
    type: 'single',
    requiredInputs: 10,
    details: 'Identifies turning points with minimal lag. Oscillates around zero line.',
    createIndicator: () => new CG(10, 10),
    processData: (indicator, candle) => {
      indicator.add(candle.close);
      const result = indicator.isStable ? indicator.getResult() : null;
      const signal = indicator.getSignal();
      return {result, signal, close: candle.close};
    },
    getChartData: result => ({x: 0, y: result.result}),
    getTableColumns: () => [
      {header: 'Period', key: 'period'},
      {header: 'Date', key: 'date'},
      {header: 'Close', key: 'close', render: val => `$${val.toFixed(2)}`, className: 'text-slate-300 py-2 px-3'},
      {header: 'CG', key: 'result', className: 'text-white font-mono py-2 px-3'},
      {header: 'Signal', key: 'signal', render: val => <SignalBadge signal={val} />, className: 'py-2 px-3'},
    ],
    chartTitle: 'Center of Gravity (10,10)',
    yAxisLabel: 'CG',
  },
  {
    id: 'mom',
    name: 'MOM',
    description: 'Momentum',
    color: '#84cc16',
    type: 'single',
    requiredInputs: 5,
    details:
      'Momentum measures the change in price over n periods. Bullish when momentum is positive (price rising), bearish when momentum is negative (price falling).',
    createIndicator: () => new MOM(5),
    processData: (indicator, candle) => {
      indicator.add(candle.close);
      const result = indicator.isStable ? indicator.getResult() : null;
      const signal = indicator.getSignal();
      return {result, signal, close: candle.close};
    },
    getChartData: result => ({x: 0, y: result.result}),
    getTableColumns: () => [
      {header: 'Period', key: 'period'},
      {header: 'Date', key: 'date'},
      {header: 'Close', key: 'close', render: val => `$${val.toFixed(2)}`, className: 'text-slate-300 py-2 px-3'},
      {header: 'MOM', key: 'result', className: 'text-white font-mono py-2 px-3'},
      {header: 'Signal', key: 'signal', render: val => <SignalBadge signal={val} />, className: 'py-2 px-3'},
    ],
    chartTitle: 'Momentum (5)',
    yAxisLabel: 'MOM',
  },
  {
    id: 'obv',
    name: 'OBV',
    description: 'On-Balance Volume',
    color: '#14b8a6',
    type: 'single',
    requiredInputs: 1,
    details: 'Cumulative volume-based indicator. Rising OBV with rising prices confirms uptrend.',
    createIndicator: () => new OBV(5),
    processData: (indicator, candle) => {
      indicator.add(candle);
      const result = indicator.getResult();
      const signal = indicator.getSignal();
      return {result, signal, close: candle.close, volume: candle.volume};
    },
    getChartData: result => ({x: 0, y: result.result}),
    getTableColumns: () => [
      {header: 'Period', key: 'period'},
      {header: 'Date', key: 'date'},
      {header: 'Close', key: 'close', render: val => `$${val.toFixed(2)}`, className: 'text-slate-300 py-2 px-3'},
      {header: 'Volume', key: 'volume', className: 'text-slate-300 py-2 px-3'},
      {header: 'OBV', key: 'result', className: 'text-white font-mono py-2 px-3'},
      {header: 'Signal', key: 'signal', render: val => <SignalBadge signal={val} />, className: 'py-2 px-3'},
    ],
    chartTitle: 'On-Balance Volume (5)',
    yAxisLabel: 'OBV',
  },
  {
    id: 'rei',
    name: 'REI',
    description: 'Range Expansion Index',
    color: '#a855f7',
    type: 'single',
    requiredInputs: 5,
    details: 'Measures range expansion to identify potential breakouts.',
    createIndicator: () => new REI(5),
    processData: (indicator, candle) => {
      indicator.add(candle);
      const result = indicator.isStable ? indicator.getResult() : null;
      const signal = indicator.getSignal();
      return {result, signal, close: candle.close};
    },
    getChartData: result => ({x: 0, y: result.result}),
    getTableColumns: () => [
      {header: 'Period', key: 'period'},
      {header: 'Date', key: 'date'},
      {header: 'Close', key: 'close', render: val => `$${val.toFixed(2)}`, className: 'text-slate-300 py-2 px-3'},
      {header: 'REI', key: 'result', className: 'text-white font-mono py-2 px-3'},
      {header: 'Signal', key: 'signal', render: val => <SignalBadge signal={val} />, className: 'py-2 px-3'},
    ],
    chartTitle: 'Range Expansion Index (5)',
    yAxisLabel: 'REI',
  },
  {
    id: 'stochrsi',
    name: 'StochRSI',
    description: 'Stochastic RSI',
    color: '#ef4444',
    type: 'single',
    requiredInputs: 14,
    details: 'Applies Stochastic Oscillator to RSI values. More sensitive to overbought/oversold than standard RSI.',
    createIndicator: () => new StochasticRSI(14),
    processData: (indicator, candle) => {
      indicator.add(candle.close);
      const result = indicator.isStable ? indicator.getResult() : null;
      const signal = indicator.getSignal();
      return {result, signal, close: candle.close};
    },
    getChartData: result => ({x: 0, y: result.result}),
    getTableColumns: () => [
      {header: 'Period', key: 'period'},
      {header: 'Date', key: 'date'},
      {header: 'Close', key: 'close', render: val => `$${val.toFixed(2)}`, className: 'text-slate-300 py-2 px-3'},
      {header: 'StochRSI', key: 'result', className: 'text-white font-mono py-2 px-3'},
      {header: 'Signal', key: 'signal', render: val => <SignalBadge signal={val} />, className: 'py-2 px-3'},
    ],
    chartTitle: 'Stochastic RSI (14)',
    yAxisLabel: 'StochRSI',
  },
  {
    id: 'tds',
    name: 'TDS',
    description: 'Tom DeMark Sequential',
    color: '#ec4899',
    type: 'single',
    requiredInputs: 1,
    details:
      'TDS tracks consecutive closes compared to the close 4 bars earlier. Bullish Setup: 9 consecutive closes greater than the close 4 bars earlier (returns 1, signals potential reversal - BEARISH). Bearish Setup: 9 consecutive closes less than the close 4 bars earlier (returns -1, signals potential reversal - BULLISH).',
    createIndicator: () => new TDS(),
    processData: (indicator, candle) => {
      indicator.add(candle.close);
      const result = indicator.getResult();
      const signal = indicator.getSignal();
      return {result, signal, close: candle.close};
    },
    getChartData: result => ({x: 0, y: result.result}),
    getTableColumns: () => [
      {header: 'Period', key: 'period'},
      {header: 'Date', key: 'date'},
      {header: 'Close', key: 'close', render: val => `$${val.toFixed(2)}`, className: 'text-slate-300 py-2 px-3'},
      {header: 'TDS', key: 'result', className: 'text-white font-mono py-2 px-3'},
      {header: 'Signal', key: 'signal', render: val => <SignalBadge signal={val} />, className: 'py-2 px-3'},
    ],
    chartTitle: 'Tom DeMark Sequential',
    yAxisLabel: 'TDS',
  },
  {
    id: 'willr',
    name: 'Williams %R',
    description: 'Williams Percent Range',
    color: '#22d3ee',
    type: 'single',
    requiredInputs: 14,
    details:
      'Measures overbought and oversold levels on an inverted scale from 0 to -100. Values from 0 to -20 indicate overbought conditions, while -80 to -100 indicate oversold conditions.',
    createIndicator: () => new WilliamsR(14),
    processData: (indicator, candle) => {
      indicator.add(candle);
      const result = indicator.isStable ? indicator.getResult() : null;
      const signal = indicator.getSignal();
      return {result, signal, high: candle.high, low: candle.low, close: candle.close};
    },
    getChartData: result => ({x: 0, y: result.result}),
    getTableColumns: () => [
      {header: 'Period', key: 'period'},
      {header: 'Date', key: 'date'},
      {header: 'High', key: 'high', render: val => `$${val.toFixed(2)}`, className: 'text-slate-300 py-2 px-3'},
      {header: 'Low', key: 'low', render: val => `$${val.toFixed(2)}`, className: 'text-slate-300 py-2 px-3'},
      {header: 'Close', key: 'close', render: val => `$${val.toFixed(2)}`, className: 'text-slate-300 py-2 px-3'},
      {header: 'Williams %R', key: 'result', className: 'text-white font-mono py-2 px-3'},
      {header: 'Signal', key: 'signal', render: val => <SignalBadge signal={val} />, className: 'py-2 px-3'},
    ],
    chartTitle: 'Williams %R (14)',
    yAxisLabel: 'Williams %R',
  },
];

const renderSingleIndicator = (config: IndicatorConfig) => {
  const indicator = config.createIndicator!();
  const chartData: ChartDataPoint[] = [];
  const sampleValues: any[] = [];

  ethCandles.forEach((candle, idx) => {
    const processedData = config.processData!(indicator, candle, idx);
    const chartPoint = config.getChartData!(processedData);

    if (Array.isArray(chartPoint)) {
      chartData.push(...chartPoint);
    } else {
      chartData.push({x: idx + 1, y: chartPoint.y});
    }

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

      <DataTable title="All Sample Values" columns={config.getTableColumns!()} data={sampleValues} />
    </div>
  );
};

export default function MomentumIndicators() {
  const [selectedIndicator, setSelectedIndicator] = useState<string>('rsi');

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash && indicators.some(ind => ind.id === hash)) {
      setSelectedIndicator(hash);
    }
  }, []);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      if (hash && indicators.some(ind => ind.id === hash)) {
        setSelectedIndicator(hash);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleIndicatorChange = (indicatorId: string) => {
    setSelectedIndicator(indicatorId);
    window.location.hash = indicatorId;
  };

  const renderIndicatorContent = () => {
    const config = indicators.find(ind => ind.id === selectedIndicator);
    if (!config) return null;

    if (config.type === 'single') {
      return renderSingleIndicator(config);
    }

    switch (selectedIndicator) {
      case 'stoch':
        // Stochastic needs 2 series (%K and %D)
        return renderStochastic(config);
      case 'macd':
        // MACD needs 3 series (MACD line, Signal line, Histogram with different chart type)
        return renderMACD(config);
      default:
        return null;
    }
  };

  const renderStochastic = (config: IndicatorConfig) => {
    const stoch = new StochasticOscillator(14, 3, 3);
    const chartDataK: ChartDataPoint[] = [];
    const chartDataD: ChartDataPoint[] = [];
    const sampleValues: Array<{period: number; date: string; close: number; k: string; d: string; signal: string}> = [];

    ethCandles.forEach((candle, idx) => {
      stoch.add({high: candle.high, low: candle.low, close: candle.close});
      const result = stoch.isStable ? stoch.getResult() : null;
      const signal = stoch.getSignal();
      chartDataK.push({x: idx + 1, y: result?.stochK ?? null});
      chartDataD.push({x: idx + 1, y: result?.stochD ?? null});

      sampleValues.push({
        period: idx + 1,
        date: candle.date,
        close: candle.close,
        k: result ? result.stochK.toFixed(2) : 'N/A',
        d: result ? result.stochD.toFixed(2) : 'N/A',
        signal: signal.state,
      });
    });

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2 select-text">
            StochasticOscillator({stoch.n}, {stoch.m}, {stoch.p}) / Required Inputs: {stoch.getRequiredInputs()}
          </h2>
          <p className="text-slate-300 select-text">{config.description}</p>
          <p className="text-slate-400 text-sm mt-2 select-text">
            Compares closing price to price range over a period. %K crossing above %D can signal a buying opportunity.
          </p>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          <HighchartsChart
            options={{
              chart: {
                type: 'line',
                backgroundColor: 'transparent',
                height: 300,
              },
              title: {
                text: 'Stochastic Oscillator (14,3,3)',
                style: {
                  color: '#e2e8f0',
                  fontSize: '16px',
                  fontWeight: '600',
                },
              },
              credits: {
                enabled: false,
              },
              xAxis: {
                title: {
                  text: 'Period',
                  style: {color: '#94a3b8'},
                },
                labels: {
                  style: {color: '#94a3b8'},
                },
                gridLineColor: '#334155',
              },
              yAxis: {
                title: {
                  text: 'Value',
                  style: {color: '#94a3b8'},
                },
                labels: {
                  style: {color: '#94a3b8'},
                },
                gridLineColor: '#334155',
              },
              legend: {
                enabled: true,
                itemStyle: {
                  color: '#e2e8f0',
                },
              },
              plotOptions: {
                line: {
                  marker: {
                    enabled: true,
                    radius: 3,
                  },
                  lineWidth: 2,
                },
              },
              series: [
                {
                  type: 'line',
                  name: '%K',
                  data: chartDataK.map(point => [point.x, point.y]),
                  color: config.color,
                  marker: {
                    fillColor: config.color,
                  },
                },
                {
                  type: 'line',
                  name: '%D',
                  data: chartDataD.map(point => [point.x, point.y]),
                  color: '#f97316',
                  marker: {
                    fillColor: '#f97316',
                  },
                },
              ],
              tooltip: {
                backgroundColor: '#1e293b',
                borderColor: '#475569',
                style: {
                  color: '#e2e8f0',
                },
                shared: true,
                formatter: function (): string {
                  let s: string = `<b>Period ${(this as any).x}</b><br/>`;
                  ((this as any).points as any[])?.forEach((point: any) => {
                    const yValue = typeof point.y === 'number' ? point.y.toFixed(2) : 'N/A';
                    s += `${point.series.name}: ${yValue}<br/>`;
                  });
                  return s;
                },
              },
            }}
          />
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-white mb-3">All Sample Values</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-600">
                  <th className="text-left text-slate-300 py-2 px-3">Period</th>
                  <th className="text-left text-slate-300 py-2 px-3">Date</th>
                  <th className="text-left text-slate-300 py-2 px-3">Close</th>
                  <th className="text-left text-slate-300 py-2 px-3">%K</th>
                  <th className="text-left text-slate-300 py-2 px-3">%D</th>
                  <th className="text-left text-slate-300 py-2 px-3">Signal</th>
                </tr>
              </thead>
              <tbody>
                {sampleValues.map(row => (
                  <tr key={row.period} className="border-b border-slate-700/50">
                    <td className="text-slate-400 py-2 px-3">{row.period}</td>
                    <td className="text-slate-400 py-2 px-3">{row.date}</td>
                    <td className="text-slate-300 py-2 px-3">${row.close.toFixed(2)}</td>
                    <td className="text-white font-mono py-2 px-3">{row.k}</td>
                    <td className="text-white font-mono py-2 px-3">{row.d}</td>
                    <td className="py-2 px-3">
                      <SignalBadge signal={row.signal} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderMACD = (config: IndicatorConfig) => {
    const macd = new MACD(new EMA(12), new EMA(26), new EMA(9));
    const chartDataMACD: ChartDataPoint[] = [];
    const chartDataSignal: ChartDataPoint[] = [];
    const chartDataHistogram: ChartDataPoint[] = [];
    const sampleValues: Array<{period: number; date: string; close: number; result: string; signal: string}> = [];

    ethCandles.forEach((candle, idx) => {
      macd.add(candle.close);
      const result = macd.isStable ? macd.getResult() : null;
      const trendSignal = macd.getSignal();
      chartDataMACD.push({x: idx + 1, y: result?.macd ?? null});
      chartDataSignal.push({x: idx + 1, y: result?.signal ?? null});
      chartDataHistogram.push({x: idx + 1, y: result?.histogram ?? null});

      sampleValues.push({
        period: idx + 1,
        date: candle.date,
        close: candle.close,
        result: result ? `${result.macd.toFixed(4)}` : 'N/A',
        signal: trendSignal.state,
      });
    });

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2 select-text">
            MACD(12, 26, 9) / Required Inputs: {macd.getRequiredInputs()}
          </h2>
          <p className="text-slate-300 select-text">{config.description}</p>
          <p className="text-slate-400 text-sm mt-2 select-text">
            Shows relationship between two moving averages. Crossing above signal line = bullish, crossing below =
            bearish.
          </p>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          <HighchartsChart
            options={{
              chart: {
                type: 'line',
                backgroundColor: 'transparent',
                height: 300,
              },
              title: {
                text: 'MACD (12,26,9)',
                style: {
                  color: '#e2e8f0',
                  fontSize: '16px',
                  fontWeight: '600',
                },
              },
              credits: {
                enabled: false,
              },
              xAxis: {
                title: {
                  text: 'Period',
                  style: {color: '#94a3b8'},
                },
                labels: {
                  style: {color: '#94a3b8'},
                },
                gridLineColor: '#334155',
              },
              yAxis: {
                title: {
                  text: 'Value',
                  style: {color: '#94a3b8'},
                },
                labels: {
                  style: {color: '#94a3b8'},
                },
                gridLineColor: '#334155',
              },
              legend: {
                enabled: true,
                itemStyle: {
                  color: '#e2e8f0',
                },
              },
              plotOptions: {
                line: {
                  marker: {
                    enabled: true,
                    radius: 3,
                  },
                  lineWidth: 2,
                },
                column: {
                  borderWidth: 0,
                },
              },
              series: [
                {
                  type: 'line',
                  name: 'MACD',
                  data: chartDataMACD.map(point => [point.x, point.y]),
                  color: config.color,
                  marker: {
                    fillColor: config.color,
                  },
                },
                {
                  type: 'line',
                  name: 'Signal',
                  data: chartDataSignal.map(point => [point.x, point.y]),
                  color: '#f97316',
                  marker: {
                    fillColor: '#f97316',
                  },
                },
                {
                  type: 'column',
                  name: 'Histogram',
                  data: chartDataHistogram.map(point => [point.x, point.y]),
                  color: '#6366f1',
                  opacity: 0.5,
                },
              ],
              tooltip: {
                backgroundColor: '#1e293b',
                borderColor: '#475569',
                style: {
                  color: '#e2e8f0',
                },
                shared: true,
                formatter: function (): string {
                  let s: string = `<b>Period ${(this as any).x}</b><br/>`;
                  ((this as any).points as any[])?.forEach((point: any) => {
                    const yValue = typeof point.y === 'number' ? point.y.toFixed(4) : 'N/A';
                    s += `${point.series.name}: ${yValue}<br/>`;
                  });
                  return s;
                },
              },
            }}
          />
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-white mb-3">All Sample Values</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-600">
                  <th className="text-left text-slate-300 py-2 px-3">Period</th>
                  <th className="text-left text-slate-300 py-2 px-3">Date</th>
                  <th className="text-left text-slate-300 py-2 px-3">Close</th>
                  <th className="text-left text-slate-300 py-2 px-3">MACD</th>
                  <th className="text-left text-slate-300 py-2 px-3">Signal</th>
                </tr>
              </thead>
              <tbody>
                {sampleValues.map(row => (
                  <tr key={row.period} className="border-b border-slate-700/50">
                    <td className="text-slate-400 py-2 px-3">{row.period}</td>
                    <td className="text-slate-300 py-2 px-3">{row.date}</td>
                    <td className="text-slate-300 py-2 px-3">${row.close.toFixed(2)}</td>
                    <td className="text-white font-mono py-2 px-3">{row.result}</td>
                    <td className="py-2 px-3">
                      <SignalBadge signal={row.signal} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex gap-6">
      {/* Sidebar */}
      <aside className="w-64 shrink-0">
        <div className="sticky top-6 bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-white mb-4">Momentum Indicators</h2>
          <nav className="space-y-1">
            {indicators.map(indicator => (
              <button
                key={indicator.id}
                onClick={() => handleIndicatorChange(indicator.id)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                  selectedIndicator === indicator.id
                    ? 'bg-purple-600 text-white font-medium'
                    : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                }`}>
                <div className="font-medium">{indicator.name}</div>
                <div className="text-xs opacity-75">{indicator.description}</div>
              </button>
            ))}
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0">{renderIndicatorContent()}</main>
    </div>
  );
}
