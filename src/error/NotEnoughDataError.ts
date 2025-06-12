export class NotEnoughDataError extends Error {
  constructor(requiredAmount: number) {
    super(`Not enough data. A minimum of "${requiredAmount}" inputs is required to perform the computation.`);
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = 'NotEnoughDataError';
  }
}
