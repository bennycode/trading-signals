import {MovingAverage} from './MovingAverage.js';

class MyAverage extends MovingAverage {
  iterations = 0;
  total = 0;

  override getRequiredInputs() {
    return this.interval;
  }

  update(price: number) {
    if (this.result === undefined) {
      this.result = 0;
    }
    this.iterations += 1;
    this.total += price;
    return (this.result = this.total / this.iterations);
  }
}

describe('MovingAverage', () => {
  it('can be used to implement custom average calculations based on primitive numbers', () => {
    const average = new MyAverage(Infinity);
    expect(average.isStable).toBe(false);
    expect(() => average.getResultOrThrow()).toThrowError();
    average.add(50);
    average.add(100);
    const result = average.getResultOrThrow();
    expect(result).toBe(75);
  });
});
