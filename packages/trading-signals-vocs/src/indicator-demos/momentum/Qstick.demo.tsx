import {Qstick as QstickClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const Qstick: IndicatorConfig = {
  chartTitle: 'Qstick (8)',
  color: '#0d9488',
  createIndicator: () => new QstickClass(),
  description: 'Qstick',
  details:
    'Averages the candle bodies (close minus open) over an interval to show whether buyers or sellers control the closes. Above zero buyers close candles above their opens, below zero sellers pin closes below the opens.',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['open', 'high', 'low', 'close']}),
  id: 'qstick',
  name: 'Qstick',
  processData: makeProcessData({rowInputs: ['open', 'high', 'low', 'close']}),
  requiredInputs: 8,
  type: 'single',
  yAxisLabel: 'Qstick',
};
