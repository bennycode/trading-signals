import {describe, expect, it} from 'vitest';
import {AlpacaAPI} from '@typedtrader/exchange';
import {SP500MomentumReport, SP500MomentumSchema} from './SP500MomentumReport.js';

function createApi(): AlpacaAPI {
  return new AlpacaAPI({apiKey: 'test-key', apiSecret: 'test-secret', usePaperTrading: true});
}

describe('SP500MomentumReport', () => {
  it('has the correct NAME', () => {
    expect(SP500MomentumReport.NAME).toBe('@typedtrader/report-sp500-momentum');
  });

  it('accepts an empty config (credentials come from the injected AlpacaAPI)', () => {
    expect(() => SP500MomentumSchema.parse({})).not.toThrow();
  });

  it('stores config from constructor', () => {
    const config = SP500MomentumSchema.parse({});
    const report = new SP500MomentumReport(config, createApi());
    expect(report.config).toEqual({});
  });
});
