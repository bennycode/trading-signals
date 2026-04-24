import {BreakoutBarLow as BreakoutBarLowClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const BreakoutBarLow: IndicatorConfig = {
  id: 'breakout-bar-low',
  name: 'BreakoutBarLow',
  description: 'Breakout-Bar Low',
  color: '#f59e0b',
  type: 'single',
  requiredInputs: 21,
  details:
    'Emits the low of any candle whose high strictly exceeds the highest high of the prior N candles — a breakout bar. The breakout-bar low is commonly used as a momentum-based stop: if price trades back below it, the breakout has failed.',
  createIndicator: () => new BreakoutBarLowClass({lookback: 20}),
  processData: makeProcessData({rowInputs: ['high', 'low']}),
  getTableColumns: indicator => buildTableColumns({inputs: ['high', 'low'], indicator}),
  chartTitle: 'Breakout-Bar Low (20)',
  yAxisLabel: 'Price',
};
