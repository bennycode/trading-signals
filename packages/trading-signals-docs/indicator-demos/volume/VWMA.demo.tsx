import {VWMA as VWMAClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const VWMA: IndicatorConfig = {
  chartTitle: 'Volume Weighted Moving Average (20)',
  color: '#6366f1',
  createIndicator: () => new VWMAClass(20),
  description: 'Volume Weighted Moving Average',
  details:
    'Similar to SMA but weights each price by its volume. High-volume bars have more influence. Uses a signal line (SMA by default) for crossover signals. When VWMA crosses above the signal line, it indicates bullish momentum.',
  getTableColumns: indicator => buildTableColumns({inputs: ['close', 'volume'], indicator}),
  id: 'vwma',
  name: 'VWMA',
  processData: makeProcessData({rowInputs: ['close', 'volume'], addInputs: ['close', 'high', 'low', 'volume']}),
  requiredInputs: 20,
  type: 'single',
  yAxisLabel: 'VWMA',
};
