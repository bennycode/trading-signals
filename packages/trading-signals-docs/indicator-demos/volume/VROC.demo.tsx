import {VROC as VROCClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const VROC: IndicatorConfig = {
  chartTitle: 'Volume Rate of Change (14)',
  color: '#06b6d4',
  createIndicator: () => new VROCClass(14),
  description: 'Volume Rate of Change',
  details:
    'Measures percentage change in volume over a period. Positive VROC indicates increasing volume (confirms trend), negative VROC indicates declining volume (weakening trend).',
  getTableColumns: indicator => buildTableColumns({inputs: ['volume'], indicator}),
  id: 'vroc',
  name: 'VROC',
  processData: makeProcessData({rowInputs: ['volume']}),
  requiredInputs: 15,
  type: 'single',
  yAxisLabel: 'VROC %',
};
