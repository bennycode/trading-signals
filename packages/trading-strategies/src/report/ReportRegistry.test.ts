import {describe, expect, it} from 'vitest';
import {createReport, getReportNames} from './ReportRegistry.js';

describe('ReportRegistry', () => {
  it('lists available report names', () => {
    const names = getReportNames();
    expect(names).toContain('@typedtrader/report-sp500-momentum');
  });

  it('creates a report by name with config', () => {
    const report = createReport('@typedtrader/report-sp500-momentum', {apiKey: 'test-key', apiSecret: 'test-secret'});
    expect(report).toBeDefined();
    expect(report.config.apiKey).toBe('test-key');
  });

  it('throws for unknown report name', () => {
    expect(() => createReport('nonexistent', {})).toThrow('Unknown report');
  });
});
