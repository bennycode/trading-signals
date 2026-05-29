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
