import {SwingHigh as SwingHighClass, SwingLookback} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const SwingHigh: IndicatorConfig = {
  id: 'swing-high',
  name: 'SwingHigh',
  description: 'Swing High Detector',
  color: '#ef4444',
  type: 'single',
  requiredInputs: 5,
  details:
    'Detects symmetric pivot highs (fractal pivots). A candle is confirmed as a swing high once the configured number of candles on each side print strictly lower highs. Commonly used to mark resistance and breakout targets.',
  createIndicator: () => new SwingHighClass({lookback: SwingLookback.BILL_WILLIAMS}),
  processData: makeProcessData({rowInputs: ['high', 'close'], addInputs: ['high', 'low']}),
  getTableColumns: () => buildTableColumns({inputs: ['high', 'close'], signal: false}),
  chartTitle: 'Swing High (lookback 2)',
  yAxisLabel: 'Price',
};
