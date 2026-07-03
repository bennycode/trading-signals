import type {OrderSide} from '@typedtrader/exchange';
import type {OrderAdvice} from './TradingSessionTypes.js';

export class OrderSizeBelowMinimumError extends Error {
  readonly side: OrderSide;
  readonly amountIn: OrderAdvice['amountIn'];
  readonly size: string;
  readonly minimumSize: string;

  constructor(params: {side: OrderSide; amountIn: OrderAdvice['amountIn']; size: string; minimumSize: string}) {
    super(`Order size "${params.size}" is below minimum "${params.amountIn}" size of "${params.minimumSize}"`);
    this.name = 'OrderSizeBelowMinimumError';
    this.side = params.side;
    this.amountIn = params.amountIn;
    this.size = params.size;
    this.minimumSize = params.minimumSize;
  }
}
