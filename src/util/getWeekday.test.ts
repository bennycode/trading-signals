import {isMonday, isTuesday, isWednesday, isThursday, isFriday, isSaturday, isSunday} from './getWeekday.js';

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

  describe('isMonday', () => {
    it('handles different timezones correctly', () => {
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

  describe('isSunday', () => {
    it('works with ISO 8601 formatted times', () => {
      // 5 AM UTC on Monday (trailing Z meaning Zulu time, zero degrees longitude)
      const iso8601UTC = '2025-08-24T17:04:29.174Z';
      const date = new Date(iso8601UTC);
      expect(isSunday('Europe/Berlin', date)).toBe(true);
      expect(isMonday('Europe/Berlin', date)).toBe(false);

      // Kiritimati Island is on UTC+14 (the furthest ahead of UTC), where the given time would be already Monday
      expect(isMonday('Pacific/Kiritimati', date)).toBe(true);

      // During August, California is on PDT (UTC-7)
      const august = '2025-08-24T10:04:29.174-07:00';
      expect(isSunday('America/Los_Angeles', new Date(august))).toBe(true);
    });

    it('handles date line crossing', () => {
      // Test with Pacific timezone where date differs from UTC
      // January 1, 2024 at 7 AM UTC = December 31, 2023 at 11 PM PST
      const date = new Date('2024-01-01T07:00:00Z'); // 7 AM UTC Monday
      expect(isMonday('UTC', date)).toBe(true);
      expect(isSunday('America/Los_Angeles', date)).toBe(true); // Still Sunday at 11 PM PST
    });
  });
});
