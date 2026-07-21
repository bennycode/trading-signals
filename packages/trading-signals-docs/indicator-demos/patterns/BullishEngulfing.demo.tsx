import {BullishEngulfing as BullishEngulfingClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const BullishEngulfing: IndicatorConfig = {
  chartTitle: 'Bullish Engulfing',
  color: '#22c55e',
  createIndicator: () => new BullishEngulfingClass(),
  description: 'Bullish Engulfing Pattern',
  details:
    'A two-candle reversal pattern: a bearish candle followed by a bullish candle whose real body strictly engulfs the previous body (wicks are ignored). Returns 1 when the pattern completes on the current candle and 0 otherwise. Detects the pure candle shape without trend context — combine it with a trend indicator (e.g. EMA, ADX) to filter for reversals after a decline.',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['open', 'close']}),
  id: 'bullish-engulfing',
  name: 'Bullish Engulfing',
  processData: makeProcessData({addInputs: ['open', 'high', 'low', 'close'], rowInputs: ['open', 'close']}),
  requiredInputs: 2,
  type: 'single',
  yAxisLabel: 'Pattern',
};
