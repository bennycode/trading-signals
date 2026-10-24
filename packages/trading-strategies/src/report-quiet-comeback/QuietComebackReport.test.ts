import {AlpacaAPI} from '@typedtrader/exchange';
import {QuietComebackReport, QuietComebackSchema} from './QuietComebackReport.js';

function createApi(): AlpacaAPI {
  return new AlpacaAPI({apiKey: 'test-key', apiSecret: 'test-secret', usePaperTrading: true});
}

describe('QuietComebackReport', () => {
  it('has the correct NAME', () => {
    expect(QuietComebackReport.NAME).toBe('@typedtrader/report-quiet-comeback');
  });

  it('applies sensible defaults when given an empty config', () => {
    const config = QuietComebackSchema.parse({});

    expect(config.slowestShare, 'the slowest third is excluded unless asked otherwise').toBe(0.3);
    expect(config.symbols, 'no symbols means the S&P 500').toBeUndefined();
  });

  it('accepts custom symbols and a custom exclusion share', () => {
    const config = QuietComebackSchema.parse({slowestShare: 0.5, symbols: ['WM', 'OXY']});

    expect(config.symbols).toEqual(['WM', 'OXY']);
    expect(config.slowestShare).toBe(0.5);
  });

  it('refuses an exclusion share that would discard nearly every candidate', () => {
    const result = QuietComebackSchema.safeParse({slowestShare: 0.95});

    expect(result.success, 'dropping 95% would leave the report empty by construction').toBe(false);
  });

  it('accepts keeping every candidate', () => {
    const config = QuietComebackSchema.parse({slowestShare: 0});

    expect(config.slowestShare, 'ranking without excluding anything is a valid choice').toBe(0);
  });

  it('stores config from constructor', () => {
    const config = QuietComebackSchema.parse({symbols: ['WM']});
    const report = new QuietComebackReport(config, createApi());

    expect(report.config.symbols).toEqual(['WM']);
  });
});
