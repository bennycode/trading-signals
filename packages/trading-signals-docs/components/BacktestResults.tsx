import {Chart as HighchartsChart, type HighchartsOptionsType} from '@highcharts/react';
import {ExchangeOrderSide} from '@typedtrader/exchange';
import type {ExchangeCandle} from '@typedtrader/exchange';
import type {BacktestResult} from 'trading-strategies';
import {formatDate} from '../utils/formatDate';

interface ResultProps {
  result: BacktestResult;
  candles: ExchangeCandle[];
}

interface BacktestResultsProps extends ResultProps {
  baselineResult: BacktestResult | null;
}

function formatBig(val: import('big.js').Big, decimals = 2): string {
  return Number(val.toFixed(decimals)).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function PerformanceCards({result, candles}: ResultProps) {
  const {performance} = result;
  const returnPct = Number(performance.returnPercentage.toFixed(2));
  const winRate = Number(performance.winRate.toFixed(1));
  const hasCycles = result.trades.some(t => t.side === ExchangeOrderSide.SELL);
  const lossRate = hasCycles ? (100 - winRate).toFixed(1) : null;
  const pnl = Number(result.profitOrLoss.toFixed(2));
  const base = candles[0]?.base ?? 'Base';
  const counter = candles[0]?.counter ?? 'Counter';

  const cards = [
    {label: 'ROI', value: `${returnPct >= 0 ? '+' : ''}${returnPct}%`, positive: returnPct >= 0, info: 'Return on investment: percentage change in total portfolio value from start to end.'},
    {label: 'Profit & Loss', value: `${pnl >= 0 ? '+' : '-'}$${formatBig(result.profitOrLoss.abs())}`, positive: pnl >= 0, info: 'Absolute gain or loss in counter currency compared to the starting portfolio value.'},
    {label: 'Total Fees', value: `$${formatBig(result.totalFees)}`, positive: null, info: 'Total trading fees paid across all executed orders.'},
    {label: 'Total Trades', value: String(performance.totalTrades), positive: null, info: 'Number of individual orders executed (buys + sells).'},
    {label: 'Win Rate', value: hasCycles ? `${winRate}%` : 'N/A', positive: hasCycles ? winRate >= 50 : null, info: 'Percentage of completed buy→sell cycles that closed at a profit.'},
    {label: 'Loss Rate', value: lossRate !== null ? `${lossRate}%` : 'N/A', positive: lossRate !== null ? Number(lossRate) < 50 : null, info: 'Percentage of completed buy→sell cycles that closed at a loss. Shown in green when below 50%.'},
    {label: 'Max Win Streak', value: String(performance.maxWinStreak), positive: null, info: 'Longest consecutive sequence of profitable buy→sell cycles.'},
    {label: 'Max Loss Streak', value: String(performance.maxLossStreak), positive: null, info: 'Longest consecutive sequence of losing buy→sell cycles.'},
    {label: 'Start Value', value: `$${formatBig(performance.initialPortfolioValue)}`, positive: null, info: 'Initial portfolio value in counter currency (base × first open price + counter balance).'},
    {label: 'Final Value', value: `$${formatBig(performance.finalPortfolioValue)}`, positive: null, info: 'Final portfolio value in counter currency (base × last close price + counter balance).'},
    {label: `Final Base (${base})`, value: formatBig(result.finalBaseBalance, 6), positive: null, info: `Remaining ${base} balance at the end of the backtest.`},
    {label: `Final Counter (${counter})`, value: `$${formatBig(result.finalCounterBalance)}`, positive: null, info: `Remaining ${counter} cash balance at the end of the backtest.`},
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

function PriceChartWithTrades({result, candles}: ResultProps) {
  const priceData = candles.map((c, i) => ({
    x: i + 1,
    y: Number(c.close),
    open: Number(c.open),
    high: Number(c.high),
    low: Number(c.low),
    close: Number(c.close),
    time: formatDate(c.openTimeInISO),
  }));

  const candleIndexByTime = new Map(candles.map((c, i) => [c.openTimeInISO, i + 1]));

  const buyMarkers = result.trades
    .filter(t => t.side === ExchangeOrderSide.BUY)
    .map(t => {
      const x = candleIndexByTime.get(t.openTimeInISO) ?? 0;
      return {x, y: Number(t.price.toFixed(2)), name: `BUY @ $${t.price.toFixed(2)}`};
    })
    .filter(m => m.x > 0);

  const sellMarkers = result.trades
    .filter(t => t.side === ExchangeOrderSide.SELL)
    .map(t => {
      const x = candleIndexByTime.get(t.openTimeInISO) ?? 0;
      return {x, y: Number(t.price.toFixed(2)), name: `SELL @ $${t.price.toFixed(2)}`};
    })
    .filter(m => m.x > 0);

  const options: HighchartsOptionsType = {
    chart: {backgroundColor: 'transparent', height: 350},
    title: {text: 'Price Chart with Trades', style: {color: '#e2e8f0', fontSize: '16px', fontWeight: '600'}},
    credits: {enabled: false},
    xAxis: {
      title: {text: 'Period', style: {color: '#94a3b8'}},
      labels: {style: {color: '#94a3b8'}},
      gridLineColor: '#334155',
    },
    yAxis: {
      title: {text: 'Price', style: {color: '#94a3b8'}},
      labels: {style: {color: '#94a3b8'}},
      gridLineColor: '#334155',
    },
    legend: {
      itemStyle: {color: '#94a3b8'},
    },
    tooltip: {
      backgroundColor: '#1e293b',
      borderColor: '#475569',
      style: {color: '#e2e8f0'},
      shared: true,
      formatter: function (): string {
        const points = (this as any).points as any[];
        const first = points?.[0]?.point;
        let s = `<b>${first?.time ?? 'Period ' + (this as any).x}</b><br/>`;
        if (first) {
          s += `Open: $${first.open.toFixed(2)}<br/>`;
          s += `High: $${first.high.toFixed(2)}<br/>`;
          s += `Low: $${first.low.toFixed(2)}<br/>`;
          s += `Close: $${first.close.toFixed(2)}<br/>`;
        }
        points?.forEach((point: any) => {
          if (point.series.type === 'scatter') {
            s += `${point.point.name}<br/>`;
          }
        });
        return s;
      },
    },
    series: [
      {
        type: 'line',
        name: 'Price',
        data: priceData,
        color: '#3b82f6',
        marker: {enabled: false},
        lineWidth: 2,
      },
      {
        type: 'scatter',
        name: 'BUY',
        data: buyMarkers.map(m => ({x: m.x, y: m.y, name: m.name})),
        color: '#22c55e',
        marker: {symbol: 'triangle', radius: 6, lineColor: '#22c55e', lineWidth: 1},
        tooltip: {pointFormat: '{point.name}'},
      },
      {
        type: 'scatter',
        name: 'SELL',
        data: sellMarkers.map(m => ({x: m.x, y: m.y, name: m.name})),
        color: '#ef4444',
        marker: {symbol: 'triangle-down', radius: 6, lineColor: '#ef4444', lineWidth: 1},
        tooltip: {pointFormat: '{point.name}'},
      },
    ],
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
            <th className="text-left text-slate-400 py-2 px-3">Signal</th>
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
              <td className="py-2 px-3 text-slate-300 font-mono text-xs">
                {formatDate(trade.openTimeInISO)}
              </td>
              <td className="py-2 px-3">
                <span
                  className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                    trade.side === ExchangeOrderSide.BUY
                      ? 'bg-green-900/50 text-green-400'
                      : 'bg-red-900/50 text-red-400'
                  }`}>
                  {trade.advice.signal}
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

export function BacktestResults({result, baselineResult, candles}: BacktestResultsProps) {
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
