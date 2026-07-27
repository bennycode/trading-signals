import {Chart as HighchartsChart, type ChartOptions} from '@highcharts/react';
import type {Big} from 'big.js';
import {OrderSide} from '@typedtrader/exchange';
import type {Candle} from '@typedtrader/exchange';
import type {BacktestResult} from 'trading-strategies';
import {formatDate} from '../utils/formatDate';
import {NotAvailable} from './NotAvailable';

interface ResultProps {
  result: BacktestResult;
  candles: Candle[];
}

interface BacktestResultsProps extends ResultProps {
  baselineResult: BacktestResult | null;
}

function formatBig(val: Big, decimals = 2) {
  return Number(val.toFixed(decimals)).toLocaleString(undefined, {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  });
}

function PerformanceCards({candles, result}: ResultProps) {
  const {performance} = result;
  const returnPct = Number(performance.returnPercentage.toFixed(2));
  const winRate = Number(performance.winRate.toFixed(1));
  const hasCycles = result.trades.some(t => t.side === OrderSide.SELL);
  const lossRate = hasCycles ? (100 - winRate).toFixed(1) : null;
  const pnl = Number(result.profitOrLoss.toFixed(2));
  const base = candles[0]?.base ?? 'Base';
  const counter = candles[0]?.counter ?? 'Counter';

  const cards = [
    {
      info: 'Return on investment: percentage change in total portfolio value from start to end.',
      label: 'ROI',
      positive: returnPct >= 0,
      value: `${returnPct >= 0 ? '+' : ''}${returnPct}%`,
    },
    {
      info: 'Absolute gain or loss in counter currency compared to the starting portfolio value.',
      label: 'Profit & Loss',
      positive: pnl >= 0,
      value: `${pnl >= 0 ? '+' : '-'}$${formatBig(result.profitOrLoss.abs())}`,
    },
    {
      info: 'Total trading fees paid across all executed orders.',
      label: 'Total Fees',
      positive: null,
      value: `$${formatBig(result.totalFees)}`,
    },
    {
      info: 'Number of individual orders executed (buys + sells).',
      label: 'Total Trades',
      positive: null,
      value: String(performance.totalTrades),
    },
    {
      info: 'Percentage of completed buy→sell cycles that closed at a profit.',
      label: 'Win Rate',
      positive: hasCycles ? winRate >= 50 : null,
      value: hasCycles ? `${winRate}%` : <NotAvailable />,
    },
    {
      info: 'Percentage of completed buy→sell cycles that closed at a loss. Shown in green when below 50%.',
      label: 'Loss Rate',
      positive: lossRate !== null ? Number(lossRate) < 50 : null,
      value: lossRate !== null ? `${lossRate}%` : <NotAvailable />,
    },
    {
      info: 'Longest consecutive sequence of profitable buy→sell cycles.',
      label: 'Max Win Streak',
      positive: null,
      value: String(performance.maxWinStreak),
    },
    {
      info: 'Longest consecutive sequence of losing buy→sell cycles.',
      label: 'Max Loss Streak',
      positive: null,
      value: String(performance.maxLossStreak),
    },
    {
      info: 'Initial portfolio value in counter currency (base × first open price + counter balance).',
      label: 'Start Value',
      positive: null,
      value: `$${formatBig(performance.initialPortfolioValue)}`,
    },
    {
      info: 'Final portfolio value in counter currency (base × last close price + counter balance).',
      label: 'Final Value',
      positive: null,
      value: `$${formatBig(performance.finalPortfolioValue)}`,
    },
    {
      info: `Remaining ${base} balance at the end of the backtest.`,
      label: `Final Base (${base})`,
      positive: null,
      value: formatBig(result.finalBaseBalance, 6),
    },
    {
      info: `Remaining ${counter} cash balance at the end of the backtest.`,
      label: `Final Counter (${counter})`,
      positive: null,
      value: `$${formatBig(result.finalCounterBalance)}`,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map(card => (
        <div key={card.label} className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
          <div className="flex items-center gap-1">
            <div className="text-xs text-slate-400">{card.label}</div>
            <div className="relative group">
              <div className="text-slate-600 hover:text-slate-400 cursor-default text-xs leading-none">ⓘ</div>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-48 bg-slate-900 border border-slate-600 rounded px-2.5 py-1.5 text-xs text-slate-300 hidden group-hover:block z-10 shadow-lg">
                {card.info}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-600" />
              </div>
            </div>
          </div>
          <div
            className={`text-lg font-bold mt-1 ${
              card.positive === null ? 'text-white' : card.positive ? 'text-green-400' : 'text-red-400'
            }`}>
            {card.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function PriceChartWithTrades({candles, result}: ResultProps) {
  const priceData = candles.map((c, i) => ({
    close: Number(c.close),
    high: Number(c.high),
    low: Number(c.low),
    open: Number(c.open),
    time: formatDate(c.openTimeInISO),
    x: i + 1,
    y: Number(c.close),
  }));

  const candleIndexByTime = new Map(candles.map((c, i) => [c.openTimeInISO, i + 1]));

  const buyMarkers = result.trades
    .filter(t => t.side === OrderSide.BUY)
    .map(t => {
      const x = candleIndexByTime.get(t.openTimeInISO) ?? 0;
      return {name: `BUY @ $${t.price.toFixed(2)}`, x, y: Number(t.price.toFixed(2))};
    })
    .filter(m => m.x > 0);

  const sellMarkers = result.trades
    .filter(t => t.side === OrderSide.SELL)
    .map(t => {
      const x = candleIndexByTime.get(t.openTimeInISO) ?? 0;
      return {name: `SELL @ $${t.price.toFixed(2)}`, x, y: Number(t.price.toFixed(2))};
    })
    .filter(m => m.x > 0);

  const options: ChartOptions = {
    chart: {backgroundColor: 'transparent', height: 350},
    credits: {enabled: false},
    legend: {
      itemStyle: {color: '#94a3b8'},
    },
    series: [
      {
        color: '#3b82f6',
        data: priceData,
        lineWidth: 2,
        marker: {enabled: false},
        name: 'Price',
        type: 'line',
      },
      {
        color: '#22c55e',
        data: buyMarkers.map(m => ({name: m.name, x: m.x, y: m.y})),
        marker: {lineColor: '#22c55e', lineWidth: 1, radius: 6, symbol: 'triangle'},
        name: 'BUY',
        tooltip: {pointFormat: '{point.name}'},
        type: 'scatter',
      },
      {
        color: '#ef4444',
        data: sellMarkers.map(m => ({name: m.name, x: m.x, y: m.y})),
        marker: {lineColor: '#ef4444', lineWidth: 1, radius: 6, symbol: 'triangle-down'},
        name: 'SELL',
        tooltip: {pointFormat: '{point.name}'},
        type: 'scatter',
      },
    ],
    title: {style: {color: '#e2e8f0', fontSize: '16px', fontWeight: '600'}, text: 'Price Chart with Trades'},
    tooltip: {
      backgroundColor: '#1e293b',
      borderColor: '#475569',
      formatter: function () {
        const points = (this as any).points as any[];
        /*
         * The OHLC fields live on the line series points, not the scatter markers.
         * Don't trust points[0] — find the point that actually carries the candle data.
         */
        const ohlc = points?.find((p: any) => typeof p?.point?.open === 'number')?.point;
        let s = `<b>${ohlc?.time ?? 'Period ' + (this as any).x}</b><br/>`;
        if (ohlc) {
          s += `Open: $${ohlc.open.toFixed(2)}<br/>`;
          s += `High: $${ohlc.high.toFixed(2)}<br/>`;
          s += `Low: $${ohlc.low.toFixed(2)}<br/>`;
          s += `Close: $${ohlc.close.toFixed(2)}<br/>`;
        }
        points?.forEach((point: any) => {
          if (point.series.type === 'scatter') {
            s += `${point.point.name}<br/>`;
          }
        });
        return s;
      },
      shared: true,
      style: {color: '#e2e8f0'},
    },
    xAxis: {
      gridLineColor: '#334155',
      labels: {style: {color: '#94a3b8'}},
      title: {style: {color: '#94a3b8'}, text: 'Period'},
    },
    yAxis: {
      gridLineColor: '#334155',
      labels: {style: {color: '#94a3b8'}},
      title: {style: {color: '#94a3b8'}, text: 'Price'},
    },
  };

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
      <HighchartsChart options={options} />
    </div>
  );
}

function TradeHistoryTable({result}: {result: BacktestResult}) {
  if (result.trades.length === 0) {
    return (
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
        <h3 className="text-base font-semibold text-white mb-3">Trade History</h3>
        <p className="text-slate-400 text-sm">No trades were executed.</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 overflow-x-auto">
      <h3 className="text-base font-semibold text-white mb-3">Trade History</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700">
            <th className="text-left text-slate-400 py-2 px-3">#</th>
            <th className="text-left text-slate-400 py-2 px-3">Date</th>
            <th className="text-left text-slate-400 py-2 px-3">Order</th>
            <th className="text-right text-slate-400 py-2 px-3">Price</th>
            <th className="text-right text-slate-400 py-2 px-3">Size</th>
            <th className="text-right text-slate-400 py-2 px-3">Total</th>
            <th className="text-right text-slate-400 py-2 px-3">Fee</th>
          </tr>
        </thead>
        <tbody>
          {result.trades.map((trade, i) => (
            <tr key={i} className="border-b border-slate-800 hover:bg-slate-700/30">
              <td className="py-2 px-3 text-slate-300">{i + 1}</td>
              <td className="py-2 px-3 text-slate-300 font-mono text-xs">{formatDate(trade.openTimeInISO)}</td>
              <td className="py-2 px-3">
                <span
                  className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                    trade.side === OrderSide.BUY ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'
                  }`}>
                  {trade.advice.side} {trade.advice.type}
                </span>
              </td>
              <td className="py-2 px-3 text-right text-white font-mono">${formatBig(trade.price)}</td>
              <td className="py-2 px-3 text-right text-slate-300 font-mono">{formatBig(trade.size, 6)}</td>
              <td className="py-2 px-3 text-right text-white font-mono">${formatBig(trade.size.times(trade.price))}</td>
              <td className="py-2 px-3 text-right text-slate-400 font-mono">${formatBig(trade.fee, 4)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WinnerBadge() {
  return (
    <span className="ml-2 inline-block bg-yellow-400/20 text-yellow-300 border border-yellow-400/30 text-xs font-semibold px-2 py-0.5 rounded-full">
      Winner
    </span>
  );
}

export function BacktestResults({baselineResult, candles, result}: BacktestResultsProps) {
  const strategyWins = baselineResult
    ? result.performance.returnPercentage.gte(baselineResult.performance.returnPercentage)
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Selected Strategy{strategyWins === true && <WinnerBadge />}
        </h3>
        <PerformanceCards result={result} candles={candles} />
      </div>
      {baselineResult && (
        <div>
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Buy &amp; Hold Baseline{strategyWins === false && <WinnerBadge />}
          </h3>
          <PerformanceCards result={baselineResult} candles={candles} />
        </div>
      )}
      <PriceChartWithTrades result={result} candles={candles} />
      <TradeHistoryTable result={result} />
    </div>
  );
}
