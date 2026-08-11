import {SuperSmoother as SuperSmootherClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const SuperSmoother: IndicatorConfig = {
  chartTitle: 'SuperSmoother (10)',
  color: '#38bdf8',
  createIndicator: () => new SuperSmootherClass(10),
  description: 'SuperSmoother Filter',
  details:
    "John Ehlers' 2-pole Butterworth low-pass filter fed with a two-bar price average. It rejects wave components shorter than the interval as aliasing noise while following price with considerably less lag than an SMA or EMA of comparable smoothness.",
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['close']}),
  id: 'supersmoother',
  name: 'SuperSmoother',
  processData: makeProcessData({rowInputs: ['close']}),
  requiredInputs: 10,
  type: 'single',
  yAxisLabel: 'Price',
};
