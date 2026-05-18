import {describe, expect, it} from 'vitest';
import {AlpacaAPI} from '@typedtrader/exchange';
import {classifyDay, SP500HeatmapReport, SP500HeatmapSchema} from './SP500HeatmapReport.js';

function createApi(): AlpacaAPI {
  return new AlpacaAPI({apiKey: 'test-key', apiSecret: 'test-secret', usePaperTrading: true});
}

describe('SP500HeatmapReport', () => {
  it('has the correct NAME', () => {
    expect(SP500HeatmapReport.NAME).toBe('@typedtrader/report-sp500-heatmap');
  });

  it('accepts an empty config (credentials come from the injected AlpacaAPI)', () => {
    expect(() => SP500HeatmapSchema.parse({})).not.toThrow();
  });

  it('stores config from constructor', () => {
    const config = SP500HeatmapSchema.parse({});
    const report = new SP500HeatmapReport(config, createApi());
    expect(report.config).toEqual({});
  });
});

describe('classifyDay', () => {
  it('returns Green when return > +0.30% and breadth > 55%', () => {
    expect(classifyDay(0.31, 55.1)).toBe('Green');
    expect(classifyDay(1.5, 80)).toBe('Green');
  });

  it('returns Red when return < -0.30% and breadth < 45%', () => {
    expect(classifyDay(-0.31, 44.9)).toBe('Red');
    expect(classifyDay(-1.5, 20)).toBe('Red');
  });

  it('returns Mixed when only one side of Green is satisfied', () => {
    expect(classifyDay(0.31, 55)).toBe('Mixed');
    expect(classifyDay(0.3, 60)).toBe('Mixed');
    expect(classifyDay(1.0, 50)).toBe('Mixed');
  });

  it('returns Mixed when only one side of Red is satisfied', () => {
    expect(classifyDay(-0.31, 45)).toBe('Mixed');
    expect(classifyDay(-0.3, 40)).toBe('Mixed');
    expect(classifyDay(-1.0, 50)).toBe('Mixed');
  });

  it('returns Mixed for a flat day', () => {
    expect(classifyDay(0, 50)).toBe('Mixed');
  });
});
