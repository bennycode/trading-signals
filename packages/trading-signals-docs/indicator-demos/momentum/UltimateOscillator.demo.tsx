import {UltimateOscillator as UltimateOscillatorClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const UltimateOscillator: IndicatorConfig = {
  chartTitle: 'Ultimate Oscillator (7, 14, 28)',
  color: '#f43f5e',
  createIndicator: () => new UltimateOscillatorClass(),
  description: 'Ultimate Oscillator',
  details:
    'Blends buying pressure across three timeframes (7/14/28, weighted 4:2:1) to avoid the false divergences single-period oscillators produce. Values above 70 indicate overbought, below 30 indicate oversold.',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['close']}),
  id: 'ultosc',
  name: 'ULTOSC',
  processData: makeProcessData({addInputs: ['close', 'high', 'low'], rowInputs: ['close']}),
  requiredInputs: 29,
  type: 'single',
  yAxisLabel: 'ULTOSC',
};
