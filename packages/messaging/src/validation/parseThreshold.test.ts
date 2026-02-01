import {describe, it, expect} from 'vitest';
import {parseThreshold} from './parseThreshold.js';

describe('parseThreshold', () => {
  describe('percent thresholds', () => {
    it('parses positive percent', () => {
      expect(parseThreshold('+5%')).toEqual({
        type: 'percent',
        direction: 'up',
        value: 5,
      });
    });

    it('parses negative percent', () => {
      expect(parseThreshold('-10%')).toEqual({
        type: 'percent',
        direction: 'down',
        value: 10,
      });
    });

    it('parses decimal percent', () => {
      expect(parseThreshold('+2.5%')).toEqual({
        type: 'percent',
        direction: 'up',
        value: 2.5,
      });
    });
  });

  describe('absolute thresholds', () => {
    it('parses positive absolute', () => {
      expect(parseThreshold('+100')).toEqual({
        type: 'absolute',
        direction: 'up',
        value: 100,
      });
    });

    it('parses negative absolute', () => {
      expect(parseThreshold('-50')).toEqual({
        type: 'absolute',
        direction: 'down',
        value: 50,
      });
    });

    it('parses decimal absolute', () => {
      expect(parseThreshold('-50.5')).toEqual({
        type: 'absolute',
        direction: 'down',
        value: 50.5,
      });
    });
  });

  describe('whitespace handling', () => {
    it('trims leading and trailing whitespace', () => {
      expect(parseThreshold('  +5%  ')).toEqual({
        type: 'percent',
        direction: 'up',
        value: 5,
      });
    });
  });

  describe('invalid inputs', () => {
    it('returns null for missing sign', () => {
      expect(parseThreshold('5%')).toBeNull();
    });

    it('returns null for invalid format', () => {
      expect(parseThreshold('abc')).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(parseThreshold('')).toBeNull();
    });
  });
});
