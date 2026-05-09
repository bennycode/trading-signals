import {config} from 'dotenv-defaults';
import {AlpacaMarketData, TradingPair} from '@typedtrader/exchange';
import {RVOL} from 'trading-signals';

config({path: '../exchange/.env', defaults: '../exchange/.env.defaults'});

const market = new AlpacaMarketData({
  apiKey: process.env.ALPACA_LIVE_API_KEY!,
  apiSecret: process.env.ALPACA_LIVE_API_SECRET!,
  usePaperTrading: false,
});

// ~25 trading sessions — gives RVOL(20) a settled baseline.
const candles = await market.getCandles(new TradingPair('AMD', 'USD'), {
  intervalInMillis: 60_000,
  startTimeFirstCandle: '2026-04-01T14:30:00.000Z',
  startTimeLastCandle: '2026-05-08T21:00:00.000Z',
});

const rvol = new RVOL(20);

type SessionStats = {
  date: string;
  bars: number;
  totalVolume: number;
  peakRvol: number;
  peakAt: string;
  closingRvol: number;
};
const sessionsByDate = new Map<string, SessionStats>();

for (const c of candles) {
  rvol.add({openTimeInISO: c.openTimeInISO, volume: Number(c.volume)});
  if (!rvol.isStable) continue;

  const date = c.openTimeInISO.slice(0, 10);
  // Only track regular-session bars (14:30-21:00 UTC) for the per-session summary.
  const time = c.openTimeInISO.slice(11, 16);
  if (time < '14:30' || time >= '21:00') continue;

  const r = rvol.getResultOrThrow();
  const stats = sessionsByDate.get(date) ?? {
    bars: 0,
    closingRvol: 0,
    date,
    peakAt: '',
    peakRvol: 0,
    totalVolume: 0,
  };
  stats.bars++;
  stats.totalVolume += Number(c.volume);
  stats.closingRvol = r;
  if (r > stats.peakRvol) {
    stats.peakRvol = r;
    stats.peakAt = time;
  }
  sessionsByDate.set(date, stats);
}

const recent = [...sessionsByDate.values()].slice(-10);
console.log('AMD — RVOL(20) per regular-session day (14:30-21:00 UTC)\n');
console.log('date         bars  total-vol      peak  peakAt  close   note');
console.log('---------------------------------------------------------------');
for (const s of recent) {
  const note =
    s.date === '2026-05-05'
      ? '← earnings day'
      : s.date === '2026-05-06'
        ? '← +18% gap up'
        : s.date === '2026-05-07'
          ? '← cool-off'
          : s.date === '2026-05-08'
            ? '← +4.5% continuation'
            : '';
  console.log(
    `${s.date}  ${s.bars.toString().padStart(4)}  ${s.totalVolume.toLocaleString().padStart(10)}  ${s.peakRvol.toFixed(2).padStart(5)}  ${s.peakAt}   ${s.closingRvol.toFixed(2).padStart(4)}    ${note}`
  );
}

market.disconnect();
process.exit(0);
