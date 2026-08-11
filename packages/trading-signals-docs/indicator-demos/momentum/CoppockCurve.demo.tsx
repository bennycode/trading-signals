import {CoppockCurve as CoppockCurveClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const CoppockCurve: IndicatorConfig = {
  chartTitle: 'Coppock Curve (10/14/11)',
  color: '#f97316',
  createIndicator: () => new CoppockCurveClass(),
  description: 'Coppock Curve',
  details:
    'A long-term momentum oscillator designed for monthly bars: it adds a 14-period and an 11-period rate of change and smooths the sum with a 10-period weighted moving average. Readings above zero signal bullish momentum; the classic buy signal is an upturn from below zero after a major bottom.',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['close']}),
  id: 'coppock',
  name: 'Coppock Curve',
  processData: makeProcessData({rowInputs: ['close']}),
  requiredInputs: 24,
  type: 'single',
  yAxisLabel: 'Coppock',
};
