import {SwingHigh as SwingHighClass, SwingLookback} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const SwingHigh: IndicatorConfig = {
  chartTitle: 'Swing High (lookback 2)',
  color: '#ef4444',
  createIndicator: () => new SwingHighClass({lookback: SwingLookback.BILL_WILLIAMS}),
  description: 'Swing High Detector',
  details:
    'Detects symmetric pivot highs (fractal pivots). A candle is confirmed as a swing high once the configured number of candles on each side print strictly lower highs. Commonly used to mark resistance and breakout targets.',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['high', 'close']}),
  id: 'swing-high',
  name: 'SwingHigh',
  processData: makeProcessData({addInputs: ['high', 'low'], rowInputs: ['high', 'close']}),
  requiredInputs: 5,
  type: 'single',
  yAxisLabel: 'Price',
};
