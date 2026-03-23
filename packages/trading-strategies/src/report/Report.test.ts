import {describe, expect, it} from 'vitest';
import {Report} from './Report.js';

class TestReport extends Report<{greeting: string}> {
  static override NAME = 'test-report';

  async run(): Promise<string> {
    return `Hello, ${this.config.greeting}!`;
  }
}

describe('Report', () => {
  it('stores config and runs', async () => {
    const report = new TestReport({greeting: 'world'});
    const result = await report.run();
    expect(result).toBe('Hello, world!');
  });

  it('exposes config as readonly', () => {
    const report = new TestReport({greeting: 'value'});
    expect(report.config).toEqual({greeting: 'value'});
  });
});
