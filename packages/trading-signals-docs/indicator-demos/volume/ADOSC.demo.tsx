import {ADOSC as ADOSCClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const ADOSC: IndicatorConfig = {
  chartTitle: 'Chaikin Oscillator (3, 10)',
  color: '#6366f1',
  createIndicator: () => new ADOSCClass(),
  description: 'Chaikin Oscillator',
  details:
    'Applies the MACD principle to the Accumulation/Distribution line: the spread between a fast and slow EMA of A/D measures the momentum of money flow, flagging accumulation or distribution before price shows it.',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['close', 'volume']}),
  id: 'adosc',
  name: 'ADOSC',
  processData: makeProcessData({addInputs: ['close', 'high', 'low', 'volume'], rowInputs: ['close', 'volume']}),
  requiredInputs: 10,
  type: 'single',
  yAxisLabel: 'ADOSC',
};
