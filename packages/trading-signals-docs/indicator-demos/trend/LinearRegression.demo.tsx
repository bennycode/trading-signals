import {LinearRegression as LinearRegressionClass} from 'trading-signals';
import {NotAvailable} from '../../components/NotAvailable';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const LinearRegression: IndicatorConfig = {
  id: 'linreg',
  name: 'LINREG',
  description: 'Linear Regression',
  color: '#ec4899',
  type: 'single',
  requiredInputs: 14,
  details:
    'Fits a straight line to recent prices using least-squares. The prediction is the point on the line at the latest bar; the slope indicates trend direction and strength.',
  createIndicator: () => new LinearRegressionClass(14),
  processData: (indicator, candle) => {
    indicator.add(Number(candle.close));
    const full = indicator.isStable ? indicator.getResult() : null;
    return {
      result: full?.prediction ?? null,
      slope: full?.slope ?? null,
      close: Number(candle.close),
    };
  },
  getTableColumns: indicator =>
    buildTableColumns({
      inputs: ['close'],
      indicator,
      extra: [
        {
          header: 'Slope',
          key: 'slope',
          render: val => (val === null || val === undefined ? <NotAvailable /> : val.toFixed(4)),
          className: 'text-slate-300 font-mono py-2 px-3',
        },
      ],
    }),
  chartTitle: 'Linear Regression (14)',
  yAxisLabel: 'Price',
};
