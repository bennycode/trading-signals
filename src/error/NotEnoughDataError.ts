export class NotEnoughDataError extends Error {
  constructor(message: string = 'Not enough data') {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = 'NotEnoughDataError';
  }
}
