import {CG as CGClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const CG: IndicatorConfig = {
  id: 'cg',
  name: 'CG',
  description: 'Center of Gravity',
  color: '#f97316',
  type: 'single',
  requiredInputs: 10,
  details: 'Identifies turning points with minimal lag. Oscillates around zero line.',
  createIndicator: () => new CGClass(10, 10),
  processData: makeProcessData({rowInputs: ['close'], signal: 'required'}),
  getTableColumns: () => buildTableColumns({inputs: ['close']}),
  chartTitle: 'Center of Gravity (10,10)',
  yAxisLabel: 'CG',
};
