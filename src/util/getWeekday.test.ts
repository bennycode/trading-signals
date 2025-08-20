import {
  getWeekday,
  isMonday,
  isTuesday,
  isWednesday,
  isThursday,
  isFriday,
  isSaturday,
  isSunday,
} from './getWeekday.js';

describe('getWeekday', () => {
  it('returns the correct weekday name for a given date and timezone', () => {
    // January 1, 2024 was a Monday
    const date = new Date('2024-01-01T12:00:00Z'); // UTC noon

    expect(getWeekday('UTC', date)).toBe('Monday');
    expect(getWeekday('America/New_York', date)).toBe('Monday'); // EST: 7 AM same day
    expect(getWeekday('Europe/London', date)).toBe('Monday'); // GMT: 12 PM same day
  });

  it('handles timezone differences correctly', () => {
    // New Year's Eve 2023 at 11 PM in New York (which is Jan 1 4 AM UTC)
    const date = new Date('2024-01-01T04:00:00Z');

    expect(getWeekday('UTC', date)).toBe('Monday'); // Jan 1 in UTC
    expect(getWeekday('America/New_York', date)).toBe('Sunday'); // Dec 31 in EST
  });

  it('uses current date when date parameter is not provided', () => {
    // This test will check that the function works with default date
    // We can't test the exact value since it depends on when the test runs
    const result = getWeekday('UTC');
    expect(typeof result).toBe('string');
    expect(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']).toContain(result);
  });
});

describe('weekday indicators', () => {
  const testCases = [
    {date: new Date('2024-01-01T12:00:00Z'), day: 'Monday', func: isMonday},
    {date: new Date('2024-01-02T12:00:00Z'), day: 'Tuesday', func: isTuesday},
    {date: new Date('2024-01-03T12:00:00Z'), day: 'Wednesday', func: isWednesday},
    {date: new Date('2024-01-04T12:00:00Z'), day: 'Thursday', func: isThursday},
    {date: new Date('2024-01-05T12:00:00Z'), day: 'Friday', func: isFriday},
    {date: new Date('2024-01-06T12:00:00Z'), day: 'Saturday', func: isSaturday},
    {date: new Date('2024-01-07T12:00:00Z'), day: 'Sunday', func: isSunday},
  ] as const;

  testCases.forEach(({date, day, func}) => {
    describe(`is${day}`, () => {
      it(`returns true when the date is a ${day} in UTC`, () => {
        expect(func('UTC', date)).toBe(true);
      });

      it(`returns false when the date is not a ${day} in UTC`, () => {
        // Test with a date that's definitely not the target day
        const otherDate = new Date('2024-01-08T12:00:00Z'); // This is a Monday
        if (day !== 'Monday') {
          expect(func('UTC', otherDate)).toBe(false);
        }
      });

      it(`handles different timezones correctly for ${day}`, () => {
        expect(func('America/New_York', date)).toBe(true);
        expect(func('Europe/London', date)).toBe(true);
        expect(func('Asia/Tokyo', date)).toBe(true);
      });

      it(`uses current date when date parameter is not provided for ${day}`, () => {
        // This test checks that the function works with default date
        // We can't assert the exact result since it depends on when the test runs
        const result = func('UTC');
        expect(typeof result).toBe('boolean');
      });
    });
  });

  describe('timezone edge cases', () => {
    it('handles timezone transitions correctly', () => {
      // Test a date/time that crosses timezone boundaries
      const date = new Date('2024-01-01T05:00:00Z'); // 5 AM UTC on Monday

      expect(isMonday('UTC', date)).toBe(true);
      expect(isMonday('America/New_York', date)).toBe(true); // Still Monday at midnight EST
      expect(isMonday('Europe/London', date)).toBe(true); // Still Monday at 5 AM GMT
      expect(isMonday('Asia/Tokyo', date)).toBe(true); // Monday at 2 PM JST
    });

    it('handles date line crossing', () => {
      // Test with Pacific timezone where date differs from UTC
      // January 1, 2024 at 7 AM UTC = December 31, 2023 at 11 PM PST
      const date = new Date('2024-01-01T07:00:00Z'); // 7 AM UTC Monday

      expect(isMonday('UTC', date)).toBe(true);
      expect(isSunday('America/Los_Angeles', date)).toBe(true); // Still Sunday at 11 PM PST
    });
  });

  describe('validates against known dates', () => {
    it('correctly identifies known weekdays', () => {
      // January 2024 calendar verification
      const dates = [
        {date: new Date('2024-01-01'), expected: 'Monday'},
        {date: new Date('2024-01-02'), expected: 'Tuesday'},
        {date: new Date('2024-01-03'), expected: 'Wednesday'},
        {date: new Date('2024-01-04'), expected: 'Thursday'},
        {date: new Date('2024-01-05'), expected: 'Friday'},
        {date: new Date('2024-01-06'), expected: 'Saturday'},
        {date: new Date('2024-01-07'), expected: 'Sunday'},
      ] as const;

      for (const {date, expected} of dates) {
        expect(getWeekday('UTC', date)).toBe(expected);
      }
    });
  });
});
