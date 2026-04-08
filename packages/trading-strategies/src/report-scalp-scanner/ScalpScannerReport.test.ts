import {describe, expect, it} from 'vitest';
import {ScalpScannerReport, ScalpScannerSchema} from './ScalpScannerReport.js';

describe('ScalpScannerReport', () => {
  it('has the correct NAME', () => {
    expect(ScalpScannerReport.NAME).toBe('@typedtrader/report-scalp-scanner');
  });

  it('validates config with Zod schema', () => {
    const config = ScalpScannerSchema.parse({
      apiKey: 'test-key',
      apiSecret: 'test-secret',
    });

    expect(config.apiKey).toBe('test-key');
    expect(config.apiSecret).toBe('test-secret');
    expect(config.lookbackDays).toBe(60);
    expect(config.erThreshold).toBe(0.4);
    expect(config.symbols).toBeUndefined();
  });

  it('rejects config without apiKey', () => {
    expect(() => ScalpScannerSchema.parse({apiSecret: 'test'})).toThrow();
  });

  it('rejects config without apiSecret', () => {
    expect(() => ScalpScannerSchema.parse({apiKey: 'test'})).toThrow();
  });

  it('accepts custom symbols and lookbackDays', () => {
    const config = ScalpScannerSchema.parse({
      apiKey: 'key',
      apiSecret: 'secret',
      symbols: ['AMD', 'INTC', 'TSLA'],
      lookbackDays: 30,
      erThreshold: 0.3,
    });

    expect(config.symbols).toEqual(['AMD', 'INTC', 'TSLA']);
    expect(config.lookbackDays).toBe(30);
    expect(config.erThreshold).toBe(0.3);
  });

  it('stores config from constructor', () => {
    const config = ScalpScannerSchema.parse({apiKey: 'k', apiSecret: 's'});
    const report = new ScalpScannerReport(config);

    expect(report.config.apiKey).toBe('k');
    expect(report.config.apiSecret).toBe('s');
  });
});
