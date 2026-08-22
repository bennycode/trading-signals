import {APO as APOClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const APO: IndicatorConfig = {
  chartTitle: 'APO (12, 26)',
  color: '#0ea5e9',
  createIndicator: () => new APOClass(),
  description: 'Absolute Price Oscillator',
  details:
    "The MACD line without the signal line: reports the spread between the fast and slow EMA in the instrument's own price units, so the reading is directly actionable for a single instrument. Crossings of the zero line signal trend changes.",
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['close']}),
  id: 'apo',
  name: 'APO',
  processData: makeProcessData({rowInputs: ['close']}),
  requiredInputs: 26,
  type: 'single',
  yAxisLabel: 'APO',
};
