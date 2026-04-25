import {AccelerationBands as AccelerationBandsClass} from 'trading-signals';
import type {IndicatorConfig} from '../../utils/types';
import {renderBands} from './renderBands';

export const AccelerationBands: IndicatorConfig = {
  id: 'abands',
  name: 'ABANDS',
  description: 'Acceleration Bands',
  color: '#8b5cf6',
  type: 'custom',
  requiredInputs: 20,
  createIndicator: () => new AccelerationBandsClass(20, 4),
  customRender: (cfg, candles) =>
    renderBands(cfg, candles, {
      label: 'AccelerationBands',
      paramString: '20, 4',
      createIndicator: () => new AccelerationBandsClass(20, 4),
      addCandle: (indicator, candle) =>
        indicator.add({high: Number(candle.high), low: Number(candle.low), close: Number(candle.close)}),
      details:
        'Volatility bands based on price momentum. Two consecutive closes outside Acceleration Bands suggest an entry point in the direction of the breakout.',
    }),
};
