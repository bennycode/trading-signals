import type {OrderSide} from '../broker/Broker.js';
import type {OrderAdvice} from './TradingSessionTypes.js';

/**
 * Thrown / emitted by `TradingSession` when a strategy's advice resolves to a non-positive
 * order size — typically a `SELL ALL` against a zero base balance or a `BUY ALL` against
 * a zero counter balance. The strategy's view of the position is out of sync with the
 * broker; the session refuses to forward the order rather than send `qty=0` to the
 * exchange (which Alpaca, for example, rejects with HTTP 422 "qty must be > 0").
 */
export class NonPositiveOrderSizeError extends Error {
  readonly side: OrderSide;
  readonly amountIn: OrderAdvice['amountIn'];
  readonly size: string;

  constructor(params: {side: OrderSide; amountIn: OrderAdvice['amountIn']; size: string}) {
    super(
      `Refusing to place "${params.side}" order with non-positive size "${params.size}" ` +
        `(amountIn="${params.amountIn}"). The strategy's view of the position is likely stale.`
    );
    this.name = 'NonPositiveOrderSizeError';
    this.side = params.side;
    this.amountIn = params.amountIn;
    this.size = params.size;
  }
}

/**
 * Emitted by `TradingSession` when a strategy's advice resolves to a positive but
 * sub-minimum order size — the broker would reject it (or the order would be
 * economically meaningless). Carries `size` and `minimumSize` so listeners can
 * distinguish "tried to sell 0.005 BTC when the minimum is 0.01" from arbitrary
 * other failures.
 */
export class OrderSizeBelowMinimumError extends Error {
  readonly side: OrderSide;
  readonly amountIn: OrderAdvice['amountIn'];
  readonly size: string;
  readonly minimumSize: string;

  constructor(params: {side: OrderSide; amountIn: OrderAdvice['amountIn']; size: string; minimumSize: string}) {
    super(`Order size "${params.size}" is below minimum ${params.amountIn} size "${params.minimumSize}"`);
    this.name = 'OrderSizeBelowMinimumError';
    this.side = params.side;
    this.amountIn = params.amountIn;
    this.size = params.size;
    this.minimumSize = params.minimumSize;
  }
}
