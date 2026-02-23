import type {CandleDataset} from './types';
import uptrendCandles from '../pages/indicators/candles/uptrend.json' with {type: 'json'};
import downtrendCandles from '../pages/indicators/candles/downtrend.json' with {type: 'json'};
import sidewaysCandles from '../pages/indicators/candles/sideways.json' with {type: 'json'};
import sidewaysPgCandles from '../pages/indicators/candles/sideways-pg.json' with {type: 'json'};
import downtrendMsftCandles from '../pages/indicators/candles/downtrend-msft.json' with {type: 'json'};
import uptrendSlvCandles from '../pages/indicators/candles/uptrend-slv.json' with {type: 'json'};
import urth2024Candles from '../pages/indicators/candles/urth-2024-1h.json' with {type: 'json'};
import urth2025Candles from '../pages/indicators/candles/urth-2025-1h.json' with {type: 'json'};

export const datasets: CandleDataset[] = [
  {
    id: 'uptrend',
    name: 'Synthetic Uptrend',
    description: 'Rising market - prices trending upward (1d)',
    candles: uptrendCandles,
  },
  {
    id: 'downtrend',
    name: 'Synthetic Downtrend',
    description: 'Falling market - prices trending downward (1d)',
    candles: downtrendCandles,
  },
  {
    id: 'sideways',
    name: 'Synthetic Sideways',
    description: 'Ranging market - prices moving horizontally (1d)',
    candles: sidewaysCandles,
  },
  {
    id: 'sideways-pg',
    name: 'Sideways (PG)',
    description: 'Procter & Gamble ranging market - Oct 2025 (1h)',
    candles: sidewaysPgCandles,
  },
  {
    id: 'downtrend-msft',
    name: 'Downtrend (MSFT)',
    description: 'Microsoft sell-off - Jan 2026 (1h)',
    candles: downtrendMsftCandles,
  },
  {
    id: 'uptrend-slv',
    name: 'Uptrend (SLV)',
    description: 'iShares Silver Trust rally - Jan 2026 (1h)',
    candles: uptrendSlvCandles,
  },
  {
    id: 'urth-2024',
    name: 'MSCI World ETF (2024)',
    description: 'iShares MSCI World ETF (URTH) - full year 2024 (1h)',
    candles: urth2024Candles,
  },
  {
    id: 'urth-2025',
    name: 'MSCI World ETF (2025)',
    description: 'iShares MSCI World ETF (URTH) - full year 2025 (1h)',
    candles: urth2025Candles,
  },
];
