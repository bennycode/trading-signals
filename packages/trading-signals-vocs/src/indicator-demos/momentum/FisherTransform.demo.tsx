import {FisherTransform as FisherTransformClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const FisherTransform: IndicatorConfig = {
  chartTitle: 'Fisher Transform (10)',
  color: '#f59e0b',
  createIndicator: () => new FisherTransformClass(10),
  description: 'Fisher Transform',
  details:
    "Reshapes prices into a nearly Gaussian distribution by locating each bar's midpoint within the recent high-low range, turning reversals into sharp peaks and troughs around the zero line. The prior bar's value doubles as the classic signal line.",
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['high', 'low']}),
  id: 'fisher',
  name: 'Fisher Transform',
  processData: makeProcessData({rowInputs: ['high', 'low']}),
  requiredInputs: 10,
  type: 'single',
  yAxisLabel: 'Fisher',
};
