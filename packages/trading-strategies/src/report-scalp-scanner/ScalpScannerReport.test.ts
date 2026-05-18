import {describe, expect, it} from 'vitest';
import {AlpacaAPI} from '@typedtrader/exchange';
import {ScalpScannerReport, ScalpScannerSchema} from './ScalpScannerReport.js';

function createApi(): AlpacaAPI {
  return new AlpacaAPI({apiKey: 'test-key', apiSecret: 'test-secret', usePaperTrading: true});
}

describe('ScalpScannerReport', () => {
  it('has the correct NAME', () => {
    expect(ScalpScannerReport.NAME).toBe('@typedtrader/report-scalp-scanner');
  });

  it('applies sensible defaults when given an empty config', () => {
    const config = ScalpScannerSchema.parse({});

    expect(config.lookbackDays).toBe(60);
    expect(config.erThreshold).toBe(0.4);
    expect(config.symbols).toBeUndefined();
  });

  it('accepts custom symbols and lookbackDays', () => {
    const config = ScalpScannerSchema.parse({
      symbols: ['AMD', 'INTC', 'TSLA'],
      lookbackDays: 30,
      erThreshold: 0.3,
    });

    expect(config.symbols).toEqual(['AMD', 'INTC', 'TSLA']);
    expect(config.lookbackDays).toBe(30);
    expect(config.erThreshold).toBe(0.3);
  });

  it('stores config from constructor', () => {
    const config = ScalpScannerSchema.parse({symbols: ['AMD']});
    const report = new ScalpScannerReport(config, createApi());

    expect(report.config.symbols).toEqual(['AMD']);
  });
});
