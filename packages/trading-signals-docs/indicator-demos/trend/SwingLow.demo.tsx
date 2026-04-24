import {SwingLookback, SwingLow as SwingLowClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const SwingLow: IndicatorConfig = {
  id: 'swing-low',
  name: 'SwingLow',
  description: 'Swing Low Detector',
  color: '#10b981',
  type: 'single',
  requiredInputs: 5,
  details:
    'Detects symmetric pullback lows (fractal pivots). A candle is confirmed as a swing low once the configured number of candles on each side print strictly higher lows. Commonly used to mark support levels and structural stop-loss references.',
  createIndicator: () => new SwingLowClass({lookback: SwingLookback.BILL_WILLIAMS}),
  processData: makeProcessData({rowInputs: ['low', 'close'], addInputs: ['high', 'low']}),
  getTableColumns: () => buildTableColumns({inputs: ['low', 'close'], signal: false}),
  chartTitle: 'Swing Low (lookback 2)',
  yAxisLabel: 'Price',
};
