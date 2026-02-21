import type {CandleDataset} from './types';
import uptrendCandles from '../pages/indicators/candles/uptrend.json' with {type: 'json'};
import downtrendCandles from '../pages/indicators/candles/downtrend.json' with {type: 'json'};
import sidewaysCandles from '../pages/indicators/candles/sideways.json' with {type: 'json'};

export const datasets: CandleDataset[] = [
  {
    id: 'uptrend',
    name: 'Strong Uptrend',
    description: 'Rising market - prices trending upward',
    candles: uptrendCandles,
  },
  {
    id: 'downtrend',
    name: 'Strong Downtrend',
    description: 'Falling market - prices trending downward',
    candles: downtrendCandles,
  },
  {
    id: 'sideways',
    name: 'Synthetic Sideways',
    description: 'Ranging market - prices moving horizontally',
    candles: sidewaysCandles,
  },
];
