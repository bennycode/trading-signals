import {TRIX as TRIXClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const TRIX: IndicatorConfig = {
  chartTitle: 'TRIX (9)',
  color: '#a855f7',
  createIndicator: () => new TRIXClass(9),
  description: 'Triple Smoothed EMA Rate of Change',
  details:
    'The percent change of a triple smoothed EMA. The smoothing filters out moves shorter than the interval, so zero-line crossings whipsaw less than raw momentum oscillators.',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['close']}),
  id: 'trix',
  name: 'TRIX',
  processData: makeProcessData({rowInputs: ['close']}),
  requiredInputs: 26,
  type: 'single',
  yAxisLabel: 'TRIX (%)',
};
