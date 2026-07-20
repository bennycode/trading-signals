import {BreakoutBarLow as BreakoutBarLowClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const BreakoutBarLow: IndicatorConfig = {
  chartTitle: 'Breakout-Bar Low (20)',
  color: '#f59e0b',
  createIndicator: () => new BreakoutBarLowClass({lookback: 20}),
  description: 'Breakout-Bar Low',
  details:
    'Emits the low of any candle whose high strictly exceeds the highest high of the prior N candles — a breakout bar. The breakout-bar low is commonly used as a momentum-based stop: if price trades back below it, the breakout has failed.',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['high', 'low']}),
  id: 'breakout-bar-low',
  name: 'BreakoutBarLow',
  processData: makeProcessData({rowInputs: ['high', 'low']}),
  requiredInputs: 21,
  type: 'single',
  yAxisLabel: 'Price',
};
