import {WAD as WADClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const WAD: IndicatorConfig = {
  chartTitle: 'Williams Accumulation/Distribution',
  color: '#f97316',
  createIndicator: () => new WADClass(),
  description: 'Williams Accumulation/Distribution',
  details:
    "Larry Williams' cumulative line: an up-close adds the run from the true low to the close, a down-close subtracts the drop from the true high. Built from price alone — unlike Chaikin's AD, which weights by volume. Read against price for divergence: a price high the line refuses to confirm warns of distribution.",
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['close']}),
  id: 'wad',
  name: 'WAD',
  processData: makeProcessData({
    addInputs: ['close', 'high', 'low'],
    rowInputs: ['close'],
  }),
  requiredInputs: 2,
  type: 'single',
  yAxisLabel: 'WAD',
};
