import {LaguerreRSI as LaguerreRSIClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const LaguerreRSI: IndicatorConfig = {
  chartTitle: 'Laguerre RSI (0.5)',
  color: '#22d3ee',
  createIndicator: () => new LaguerreRSIClass(),
  description: 'Laguerre Relative Strength Index',
  details:
    'John Ehlers runs the RSI pressure reading over the four stages of a Laguerre filter instead of raw closes, so four data points behave like a full-length RSI with far less lag. The oscillator ranges from 0 to 1: readings of 0.8 or above flag an overbought market, 0.2 or below an oversold one. The damping factor gamma stretches the effective look-back — 0 compares the last four closes directly, values closer to 1 calm the oscillator.',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['close']}),
  id: 'laguerre-rsi',
  name: 'Laguerre RSI',
  processData: makeProcessData({rowInputs: ['close']}),
  requiredInputs: 4,
  type: 'single',
  yAxisLabel: 'LRSI',
};
