import {CG as CGClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const CG: IndicatorConfig = {
  chartTitle: 'Center of Gravity (10,10)',
  color: '#f97316',
  createIndicator: () => new CGClass(10, 10),
  description: 'Center of Gravity',
  details: 'Identifies turning points with minimal lag. Oscillates around zero line.',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['close']}),
  id: 'cg',
  name: 'CG',
  processData: makeProcessData({rowInputs: ['close']}),
  requiredInputs: 10,
  type: 'single',
  yAxisLabel: 'CG',
};
