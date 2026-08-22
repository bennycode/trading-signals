import {TRIMA as TRIMAClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const TRIMA: IndicatorConfig = {
  chartTitle: 'TRIMA (10)',
  color: '#a855f7',
  createIndicator: () => new TRIMAClass(10),
  description: 'Triangular Moving Average',
  details:
    'Weights the middle of the interval most heavily, tapering off towards the oldest and newest prices — equivalent to smoothing an SMA with a second SMA. Filters out most short-lived noise at the cost of extra lag.',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['close']}),
  id: 'trima',
  name: 'TRIMA',
  processData: makeProcessData({rowInputs: ['close']}),
  requiredInputs: 10,
  type: 'single',
  yAxisLabel: 'Price',
};
