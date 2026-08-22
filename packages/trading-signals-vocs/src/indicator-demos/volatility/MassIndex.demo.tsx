import {MassIndex as MassIndexClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const MassIndex: IndicatorConfig = {
  chartTitle: 'Mass Index (25)',
  color: '#f43f5e',
  createIndicator: () => new MassIndexClass(25),
  description: 'Mass Index',
  details:
    'Sums the ratio of a single- to a double-smoothed high-low range over 25 bars, so widening ranges inflate the reading regardless of direction. Donald Dorsey’s "reversal bulge" — a rise above 27 followed by a drop below 26.5 — flags a likely trend change, while the direction of the new trend must be read from a companion indicator.',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['high', 'low']}),
  id: 'mass-index',
  name: 'Mass Index',
  processData: makeProcessData({rowInputs: ['high', 'low']}),
  requiredInputs: 41,
  type: 'single',
  yAxisLabel: 'Mass Index',
};
