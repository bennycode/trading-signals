import {getFixedArray} from './getFixedArray';

describe('getFixedArray', () => {
  describe('push', () => {
    it('removes items from the beginning when the amount of items exceed the maximum length', () => {
      const maxLength = 3;
      const array = getFixedArray(maxLength);
      array.push(1);
      expect(array.length).toBe(1);
      array.push(2);
      expect(array.length).toBe(2);
      array.push(3);
      expect(array.length).toBe(maxLength);
      array.push(4);
      expect(array.length).toBe(maxLength);
      array.push(5);
      expect(array.length).toBe(maxLength);
      expect(array[0]).toBe(3);
      expect(array[1]).toBe(4);
      expect(array[2]).toBe(5);
    });

    it('works when pushing multiple items at once', () => {
      const maxLength = 3;
      const array = getFixedArray(maxLength);
      array.push(1, 2, 3, 4, 5);
      expect(array.length).toBe(maxLength);
      expect(array[0]).toBe(3);
      expect(array[1]).toBe(4);
      expect(array[2]).toBe(5);
    });
  });
});
