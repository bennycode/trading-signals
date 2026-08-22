import {KeltnerChannels as KeltnerChannelsClass} from 'trading-signals';
import type {IndicatorConfig} from '../../utils/types';
import {renderBands} from './renderBands';

export const KeltnerChannels: IndicatorConfig = {
  color: '#14b8a6',
  createIndicator: () => new KeltnerChannelsClass(),
  customRender: (cfg, candles) =>
    renderBands(cfg, candles, {
      addCandle: (indicator, candle) =>
        indicator.add({close: Number(candle.close), high: Number(candle.high), low: Number(candle.low)}),
      createIndicator: () => new KeltnerChannelsClass(),
      details:
        'Volatility envelope around an EMA whose channel width follows the Average True Range. Because the width tracks trading ranges instead of the standard deviation of closes, the channels also react to gaps and intraday swings.',
      label: 'KeltnerChannels',
      paramString: '20, 10, 2',
    }),
  description: 'Keltner Channels',
  id: 'keltner-channels',
  name: 'Keltner Channels',
  requiredInputs: 20,
  type: 'custom',
};
