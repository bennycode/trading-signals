import {BollingerBands as BollingerBandsClass} from 'trading-signals';
import type {IndicatorConfig} from '../../utils/types';
import {renderBands} from './renderBands';

export const BollingerBands: IndicatorConfig = {
  id: 'bbands',
  name: 'Bollinger Bands',
  description: 'Bollinger Bands',
  color: '#3b82f6',
  type: 'custom',
  requiredInputs: 20,
  createIndicator: () => new BollingerBandsClass(20, 2),
  customRender: (cfg, candles) =>
    renderBands(cfg, candles, {
      label: 'BollingerBands',
      paramString: '20, 2',
      createIndicator: () => new BollingerBandsClass(20, 2),
      addCandle: (indicator, candle) => indicator.add(Number(candle.close)),
      details:
        'Shows price volatility using standard deviations from a moving average. Price touching the upper band may indicate overbought, touching lower band may indicate oversold.',
    }),
};
