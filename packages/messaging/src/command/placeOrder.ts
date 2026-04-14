import {ExchangeOrderSide, getExchangeClient, TradingPair} from '@typedtrader/exchange';
import {getAccountOrError} from '../validation/getAccountOrError.js';

export interface PlaceOrderParams {
  userId: string;
  accountId: number;
  pair: TradingPair;
  side: ExchangeOrderSide;
  /** Quantity in base asset (e.g. "100" for 100 shares). */
  quantity: string;
  /** Limit price in counter asset. Omit for market orders. */
  limitPrice?: string;
}

/**
 * Places a market or limit order on the user's exchange account and returns a
 * human-readable reply. Any error (unknown account, exchange rejection, etc.)
 * is caught and folded into the returned string — the caller never sees an
 * exception.
 */
export const placeOrder = async (params: PlaceOrderParams): Promise<string> => {
  try {
    const account = getAccountOrError(params.userId, params.accountId);

    const client = getExchangeClient({
      exchangeId: account.exchange,
      apiKey: account.apiKey,
      apiSecret: account.apiSecret,
      isPaper: account.isPaper,
    });

    const sideLabel = params.side === ExchangeOrderSide.BUY ? 'BUY' : 'SELL';

    if (params.limitPrice === undefined) {
      const order = await client.placeMarketOrder(params.pair, {
        side: params.side,
        size: params.quantity,
        sizeInCounter: false,
      });

      return `Placed MARKET ${sideLabel} (${order.id}) for ${params.quantity} ${params.pair.base} on "${account.name}"`;
    }

    const order = await client.placeLimitOrder(params.pair, {
      side: params.side,
      size: params.quantity,
      price: params.limitPrice,
    });

    return `Placed LIMIT ${sideLabel} (${order.id}) for ${params.quantity} ${params.pair.base} @ ${params.limitPrice} ${params.pair.counter} on "${account.name}"`;
  } catch (error) {
    if (error instanceof Error) {
      return `Error placing order: ${error.message}`;
    }
    return 'Error placing order';
  }
};
