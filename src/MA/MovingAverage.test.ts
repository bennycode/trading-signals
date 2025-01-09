import {FasterMovingAverage} from './MovingAverage.js';

class MyAverage extends FasterMovingAverage {
  iterations = 0;
  total = 0;

  update(price: number) {
    if (this.result === undefined) {
      this.result = 0;
    }
    this.iterations += 1;
    this.total += price;
    return (this.result = this.total / this.iterations);
  }
}

describe('FasterMovingAverage', () => {
  it('can be used to implement custom average calculations based on primitive numbers', () => {
    const average = new MyAverage(Infinity);
    expect(average.isStable).toBe(false);
    expect(() => average.getResult()).toThrowError();
    average.update(50);
    average.update(100);
    const result = average.getResult();
    expect(result).toBe(75);
  });
});
