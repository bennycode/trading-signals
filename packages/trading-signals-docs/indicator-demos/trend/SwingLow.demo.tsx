import {SwingLookback, SwingLow as SwingLowClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const SwingLow: IndicatorConfig = {
  chartTitle: 'Swing Low (lookback 2)',
  color: '#10b981',
  createIndicator: () => new SwingLowClass({lookback: SwingLookback.BILL_WILLIAMS}),
  description: 'Swing Low Detector',
  details:
    'Detects symmetric pullback lows (fractal pivots). A candle is confirmed as a swing low once the configured number of candles on each side print strictly higher lows. Commonly used to mark support levels and structural stop-loss references.',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['low', 'close']}),
  id: 'swing-low',
  name: 'SwingLow',
  processData: makeProcessData({addInputs: ['high', 'low'], rowInputs: ['low', 'close']}),
  requiredInputs: 5,
  type: 'single',
  yAxisLabel: 'Price',
};
