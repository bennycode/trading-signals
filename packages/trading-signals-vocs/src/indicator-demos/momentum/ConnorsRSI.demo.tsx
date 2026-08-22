import {ConnorsRSI as ConnorsRSIClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const ConnorsRSI: IndicatorConfig = {
  chartTitle: 'ConnorsRSI (3, 2, 100)',
  color: '#0ea5e9',
  createIndicator: () => new ConnorsRSIClass(),
  description: 'Connors RSI',
  details:
    'ConnorsRSI averages three momentum readings: a 3-period RSI on closes, a 2-period RSI on the streak of consecutive up/down closes, and the percent rank of the one-bar return over the last 100 returns. Values above 90 indicate overbought, below 10 indicate oversold.',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['close']}),
  id: 'connors-rsi',
  name: 'ConnorsRSI',
  processData: makeProcessData({rowInputs: ['close']}),
  requiredInputs: 102,
  type: 'single',
  yAxisLabel: 'CRSI',
};
