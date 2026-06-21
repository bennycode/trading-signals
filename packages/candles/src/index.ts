import type {Candle} from '@typedtrader/exchange';
import downtrendRaw from '../json/downtrend.json' with {type: 'json'};
import downtrendMsftRaw from '../json/downtrend-msft.json' with {type: 'json'};
import sidewaysRaw from '../json/sideways.json' with {type: 'json'};
import sidewaysPgRaw from '../json/sideways-pg.json' with {type: 'json'};
import uptrendRaw from '../json/uptrend.json' with {type: 'json'};
import uptrendSlvRaw from '../json/uptrend-slv.json' with {type: 'json'};
import uptrendStxRaw from '../json/uptrend-stx.json' with {type: 'json'};
import urth2022Raw from '../json/urth-2022-1h.json' with {type: 'json'};
import urth2024Raw from '../json/urth-2024-1h.json' with {type: 'json'};
import urth2025Raw from '../json/urth-2025-1h.json' with {type: 'json'};

export type {Candle};

/** The dominant market direction over a dataset's span. */
export type MarketRegime = 'bear' | 'bull' | 'sideways';

export interface CandleDataset {
  candles: Candle[];
  description: string;
  id: string;
  name: string;
  /** Dominant market direction over the dataset's span (e.g. for picking a regime to test against). */
  regime: MarketRegime;
}

export const downtrendCandles: Candle[] = downtrendRaw;
export const downtrendMsftCandles: Candle[] = downtrendMsftRaw;
export const sidewaysCandles: Candle[] = sidewaysRaw;
export const sidewaysPgCandles: Candle[] = sidewaysPgRaw;
export const uptrendCandles: Candle[] = uptrendRaw;
export const uptrendSlvCandles: Candle[] = uptrendSlvRaw;
export const uptrendStxCandles: Candle[] = uptrendStxRaw;
export const urth2022Candles: Candle[] = urth2022Raw;
export const urth2024Candles: Candle[] = urth2024Raw;
export const urth2025Candles: Candle[] = urth2025Raw;

export const datasets: CandleDataset[] = [
  {
    candles: uptrendCandles,
    description: 'Rising market - prices trending upward (1d)',
    id: 'uptrend',
    name: 'Synthetic Uptrend',
    regime: 'bull',
  },
  {
    candles: downtrendCandles,
    description: 'Falling market - prices trending downward (1d)',
    id: 'downtrend',
    name: 'Synthetic Downtrend',
    regime: 'bear',
  },
  {
    candles: sidewaysCandles,
    description: 'Ranging market - prices moving horizontally (1d)',
    id: 'sideways',
    name: 'Synthetic Sideways',
    regime: 'sideways',
  },
  {
    candles: sidewaysPgCandles,
    description: 'Procter & Gamble ranging market - Oct 2025 (1h)',
    id: 'sideways-pg',
    name: 'Sideways (PG)',
    regime: 'sideways',
  },
  {
    candles: downtrendMsftCandles,
    description: 'Microsoft sell-off - Jan 2026 (1h)',
    id: 'downtrend-msft',
    name: 'Downtrend (MSFT)',
    regime: 'bear',
  },
  {
    candles: uptrendSlvCandles,
    description: 'iShares Silver Trust rally - Jan 2026 (1h)',
    id: 'uptrend-slv',
    name: 'Uptrend (SLV)',
    regime: 'bull',
  },
  {
    candles: uptrendStxCandles,
    description: 'STX uptrend with a mid-trend shakeout - Jan-Jun 2026 (1d)',
    id: 'uptrend-stx',
    name: 'Uptrend Shakeout (STX)',
    regime: 'bull',
  },
  {
    candles: urth2022Candles,
    description: 'iShares MSCI World ETF (URTH) - full year 2022, a bear market (1h)',
    id: 'urth-2022',
    name: 'MSCI World ETF (2022)',
    regime: 'bear',
  },
  {
    candles: urth2024Candles,
    description: 'iShares MSCI World ETF (URTH) - full year 2024 (1h)',
    id: 'urth-2024',
    name: 'MSCI World ETF (2024)',
    regime: 'bull',
  },
  {
    candles: urth2025Candles,
    description: 'iShares MSCI World ETF (URTH) - full year 2025 (1h)',
    id: 'urth-2025',
    name: 'MSCI World ETF (2025)',
    regime: 'bull',
  },
];

export function getDataset(id: string): CandleDataset | undefined {
  return datasets.find(dataset => dataset.id === id);
}
