import {describe, expect, it, vi, beforeEach} from 'vitest';

const mockGet = vi.fn();

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({get: mockGet})),
  },
}));

// axios-retry runs at module-load time and wraps interceptors on the axios
// instance. We bypass it because the mocked axios instance has no
// interceptors — the real retry behavior is exercised by the production
// client, not by these unit tests.
vi.mock('axios-retry', () => ({
  default: vi.fn(),
}));

const {isEarningsDay} = await import('./isEarningsDay.js');

describe('isEarningsDay', () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it('returns true when the calendar contains a matching entry for the given date and symbol', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        earningsCalendar: [{date: '2026-05-01', hour: 'amc', quarter: 1, symbol: 'AAPL', year: 2026}],
      },
    });

    const result = await isEarningsDay({
      apiKey: 'test-key',
      date: new Date('2026-05-01T14:30:00Z'),
      symbol: 'AAPL',
    });

    expect(result).toBe(true);
  });

  it('returns false when the earnings calendar is empty', async () => {
    mockGet.mockResolvedValueOnce({data: {earningsCalendar: []}});

    const result = await isEarningsDay({
      apiKey: 'test-key',
      date: new Date('2026-05-01T14:30:00Z'),
      symbol: 'AAPL',
    });

    expect(result).toBe(false);
  });

  it('returns false when the earnings calendar is null', async () => {
    mockGet.mockResolvedValueOnce({data: {earningsCalendar: null}});

    const result = await isEarningsDay({
      apiKey: 'test-key',
      date: new Date('2026-05-01T14:30:00Z'),
      symbol: 'AAPL',
    });

    expect(result).toBe(false);
  });

  it('returns false when the calendar contains a different symbol on the same date', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        earningsCalendar: [{date: '2026-05-01', hour: 'amc', quarter: 1, symbol: 'MSFT', year: 2026}],
      },
    });

    const result = await isEarningsDay({
      apiKey: 'test-key',
      date: new Date('2026-05-01T14:30:00Z'),
      symbol: 'AAPL',
    });

    expect(result).toBe(false);
  });

  it('returns false when the calendar contains the symbol but on a different date', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        earningsCalendar: [{date: '2026-05-02', hour: 'amc', quarter: 1, symbol: 'AAPL', year: 2026}],
      },
    });

    const result = await isEarningsDay({
      apiKey: 'test-key',
      date: new Date('2026-05-01T14:30:00Z'),
      symbol: 'AAPL',
    });

    expect(result).toBe(false);
  });

  it('formats the request with a UTC YYYY-MM-DD range and the expected params', async () => {
    mockGet.mockResolvedValueOnce({data: {earningsCalendar: []}});

    await isEarningsDay({
      apiKey: 'secret-key',
      // Late-evening UTC rolls into the next calendar day in Asia but stays
      // on 2026-05-01 in UTC. The implementation must anchor to UTC.
      date: new Date('2026-05-01T23:45:00Z'),
      symbol: 'AAPL',
    });

    expect(mockGet).toHaveBeenCalledWith('/calendar/earnings', {
      params: {
        from: '2026-05-01',
        symbol: 'AAPL',
        to: '2026-05-01',
        token: 'secret-key',
      },
    });
  });
});
