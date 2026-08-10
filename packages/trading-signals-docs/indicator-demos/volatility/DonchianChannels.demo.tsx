import {DonchianChannels as DonchianChannelsClass} from 'trading-signals';
import type {IndicatorConfig} from '../../utils/types';
import {renderBands} from './renderBands';

export const DonchianChannels: IndicatorConfig = {
  color: '#14b8a6',
  createIndicator: () => new DonchianChannelsClass(20),
  customRender: (cfg, candles) =>
    renderBands(cfg, candles, {
      addCandle: (indicator, candle) => indicator.add({high: Number(candle.high), low: Number(candle.low)}),
      createIndicator: () => new DonchianChannelsClass(20),
      details:
        'Frames the recent trading range: the upper band tracks the highest high and the lower band the lowest low of the interval, with the middle band halfway between. A widening channel signals rising volatility, and trend followers read new channel extremes as breakout levels.',
      label: 'DonchianChannels',
      paramString: '20',
    }),
  description: 'Donchian Channels',
  id: 'donchian-channels',
  name: 'Donchian Channels',
  requiredInputs: 20,
  type: 'custom',
};
