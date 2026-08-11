import {ProjectionOscillator as ProjectionOscillatorClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const ProjectionOscillator: IndicatorConfig = {
  chartTitle: 'PO (14)',
  color: '#f97316',
  createIndicator: () => new ProjectionOscillatorClass({interval: 14}),
  description: 'Projection Oscillator',
  details:
    'Locates the close within projection bands that ride the linear regression trend of the window: 100 means the close sits on the upper band, 0 on the lower band. Because the bands follow the trend, readings of 80/20 flag overbought/oversold conditions relative to the trend channel instead of a horizontal range.',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['close']}),
  id: 'projection-oscillator',
  name: 'PO',
  processData: makeProcessData({addInputs: ['high', 'low', 'close'], rowInputs: ['close']}),
  requiredInputs: 14,
  type: 'single',
  yAxisLabel: 'PO',
};
