import {describe, expect, it} from 'vitest';
import {classifyDay, SP500HeatmapReport, SP500HeatmapSchema} from './SP500HeatmapReport.js';

describe('SP500HeatmapReport', () => {
  it('has the correct NAME', () => {
    expect(SP500HeatmapReport.NAME).toBe('@typedtrader/report-sp500-heatmap');
  });

  it('validates config with Zod schema', () => {
    const parsed = SP500HeatmapSchema.parse({apiKey: 'test-key', apiSecret: 'test-secret'});
    expect(parsed.apiKey).toBe('test-key');
    expect(parsed.apiSecret).toBe('test-secret');
  });

  it('rejects config without apiKey', () => {
    expect(() => SP500HeatmapSchema.parse({apiSecret: 'test'})).toThrow();
  });

  it('rejects config without apiSecret', () => {
    expect(() => SP500HeatmapSchema.parse({apiKey: 'test'})).toThrow();
  });

  it('stores config from constructor', () => {
    const config = SP500HeatmapSchema.parse({apiKey: 'my-key', apiSecret: 'my-secret'});
    const report = new SP500HeatmapReport(config);
    expect(report.config.apiKey).toBe('my-key');
    expect(report.config.apiSecret).toBe('my-secret');
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
