import {describe, expect, it} from 'vitest';
import {AlpacaAPI} from '@typedtrader/exchange';
import {createReport, getReportNames} from './ReportRegistry.js';

function createApi(): AlpacaAPI {
  return new AlpacaAPI({apiKey: 'test-key', apiSecret: 'test-secret', usePaperTrading: true});
}

describe('ReportRegistry', () => {
  it('lists available report names', () => {
    const names = getReportNames();
    expect(names).toContain('@typedtrader/report-sp500-momentum');
  });

  it('creates a report by name with an injected AlpacaAPI', () => {
    const report = createReport('@typedtrader/report-sp500-momentum', {}, createApi());
    expect(report).toBeDefined();
  });

  it('throws when an account-requiring report is created without an AlpacaAPI', () => {
    expect(() => createReport('@typedtrader/report-sp500-momentum', {})).toThrow(/requires an exchange account/);
  });

  it('throws for unknown report name', () => {
    expect(() => createReport('nonexistent', {})).toThrow('Unknown report');
  });
});
