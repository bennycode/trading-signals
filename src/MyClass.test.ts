import {MyClass} from './MyClass';

describe('MyClass', () => {
  describe('returnHello', () => {
    it('returns Hello', () => {
      const myInstance = new MyClass();
      expect(myInstance.returnHello()).toBe('Hello');
    });
  });
});
