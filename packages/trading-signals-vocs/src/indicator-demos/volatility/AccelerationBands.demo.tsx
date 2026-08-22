import {AccelerationBands as AccelerationBandsClass} from 'trading-signals';
import type {IndicatorConfig} from '../../utils/types';
import {renderBands} from './renderBands';

export const AccelerationBands: IndicatorConfig = {
  color: '#8b5cf6',
  createIndicator: () => new AccelerationBandsClass(20, 4),
  customRender: (cfg, candles) =>
    renderBands(cfg, candles, {
      addCandle: (indicator, candle) =>
        indicator.add({close: Number(candle.close), high: Number(candle.high), low: Number(candle.low)}),
      createIndicator: () => new AccelerationBandsClass(20, 4),
      details:
        'Volatility bands based on price momentum. Two consecutive closes outside Acceleration Bands suggest an entry point in the direction of the breakout.',
      label: 'AccelerationBands',
      paramString: '20, 4',
    }),
  description: 'Acceleration Bands',
  id: 'abands',
  name: 'ABANDS',
  requiredInputs: 20,
  type: 'custom',
};
