import {describe, expect, it} from 'vitest';
import {SP500MomentumReport, SP500MomentumSchema} from './SP500MomentumReport.js';

describe('SP500MomentumReport', () => {
  it('has the correct NAME', () => {
    expect(SP500MomentumReport.NAME).toBe('@typedtrader/report-sp500-momentum');
  });

  it('validates config with Zod schema', () => {
    const parsed = SP500MomentumSchema.parse({apiKey: 'test-key', apiSecret: 'test-secret'});
    expect(parsed.apiKey).toBe('test-key');
    expect(parsed.apiSecret).toBe('test-secret');
  });

  it('rejects config without apiKey', () => {
    expect(() => SP500MomentumSchema.parse({apiSecret: 'test'})).toThrow();
  });

  it('rejects config without apiSecret', () => {
    expect(() => SP500MomentumSchema.parse({apiKey: 'test'})).toThrow();
  });

  it('stores config from constructor', () => {
    const config = SP500MomentumSchema.parse({apiKey: 'my-key', apiSecret: 'my-secret'});
    const report = new SP500MomentumReport(config);
    expect(report.config.apiKey).toBe('my-key');
    expect(report.config.apiSecret).toBe('my-secret');
  });
});
