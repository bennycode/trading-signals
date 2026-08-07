import {BollingerBands as BollingerBandsClass} from 'trading-signals';
import type {IndicatorConfig} from '../../utils/types';
import {renderBands} from './renderBands';

export const BollingerBands: IndicatorConfig = {
  color: '#3b82f6',
  createIndicator: () => new BollingerBandsClass(20, 2),
  customRender: (cfg, candles) =>
    renderBands(cfg, candles, {
      addCandle: (indicator, candle) => indicator.add(Number(candle.close)),
      createIndicator: () => new BollingerBandsClass(20, 2),
      details:
        'Shows price volatility using standard deviations from a moving average. Price touching the upper band may indicate overbought, touching lower band may indicate oversold.',
      label: 'BollingerBands',
      paramString: '20, 2',
    }),
  description: 'Bollinger Bands',
  id: 'bbands',
  name: 'Bollinger Bands',
  requiredInputs: 20,
  type: 'custom',
};
