import {describe, expect, it} from 'vitest';
import {Report} from './Report.js';

class TestReport extends Report {
  static override NAME = 'test-report';

  async run(): Promise<string> {
    const greeting = this.config.greeting as string;
    return `Hello, ${greeting}!`;
  }
}

describe('Report', () => {
  it('stores config and runs', async () => {
    const report = new TestReport({greeting: 'world'});
    const result = await report.run();
    expect(result).toBe('Hello, world!');
  });

  it('exposes config as readonly', () => {
    const report = new TestReport({key: 'value'});
    expect(report.config).toEqual({key: 'value'});
  });
});
