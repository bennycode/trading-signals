import {randomUUID} from 'node:crypto';
import {OrderType, type OrderOptions, type PendingOrder} from '../Broker.js';
import type {TradingPair} from '../TradingPair.js';
import type {IbkrAPI} from './api/IbkrAPI.js';
import {
  IbkrOrderSide,
  IbkrOrderType,
  IbkrTimeInForce,
  isIbkrOrderReplyMessage,
  isIbkrOrderSubmitError,
  isIbkrOrderSubmitSuccess,
  type IbkrOrderRequest,
} from './api/schema/OrderSchema.js';

/**
 * Builds an IBKR order ticket and sees its confirmation dialogue through.
 *
 * IBKR answers a submission with either an accepted order, a rejection, or one or more prompts
 * (market closed, size warnings, and so on) that must be answered before the order exists at all.
 * Each answer can raise a further prompt, so this loops, with a cap so an unexpected prompt cannot
 * spin forever.
 */
export async function submitIbkrOrder(input: {
  accountId: string;
  api: IbkrAPI;
  conid: number;
  options: OrderOptions;
  overnight: boolean;
  pair: TradingPair;
  timeInForce: typeof IbkrTimeInForce.DAY | typeof IbkrTimeInForce.GTC;
}): Promise<PendingOrder> {
  const {accountId, api, conid, options, overnight, pair, timeInForce} = input;

  const isLimit = options.type === OrderType.LIMIT;

  if (overnight && !isLimit) {
    throw new Error(
      `IBKR Overnight accepts limit orders only, so a ${options.type} order for ${pair.asString('/')} cannot reach it. Place a limit order, or construct the broker without \`overnight\`.`
    );
  }

  const isNotional = options.type === OrderType.MARKET && options.sizeInCounter;
  const request: IbkrOrderRequest = {
    /*
     * A client-generated id makes a failed POST reconcilable: the order can be looked up by it
     * instead of guessing whether the request landed, and IBKR deduplicates a resubmission.
     */
    cOID: randomUUID().replaceAll('-', '').slice(0, 32),
    conid,
    orderType: isLimit ? IbkrOrderType.LIMIT : IbkrOrderType.MARKET,
    /*
     * Limit orders are marked for the extended sessions, matching what Alpaca's mapper does.
     * IBKR allows only limit-family types there (`orderTypesOutside`), and a market order sent
     * with this flag would be refused, so it is set for limit orders alone.
     *
     * Never alongside an overnight time-in-force: that picks IBKR Overnight, a venue of its own,
     * and the extended-hours flag describes the pre-market and after-hours books instead. IBKR
     * does not combine the two, and a `whatif` preview accepts the pair without complaint, so
     * sending both produced an order that reported `Submitted` and was then cancelled unfilled
     * when the session opened.
     */
    ...(isLimit && !overnight ? {outsideRTH: true} : {}),
    side: options.side === 'BUY' ? IbkrOrderSide.BUY : IbkrOrderSide.SELL,
    /*
     * `OND` rather than `OVT`: an overnight-only order is cancelled at 03:50 ET if it has not
     * filled, which would silently drop a strategy's order before the regular session it was
     * probably meant to span. `OND` carries it through into that session instead.
     */
    tif: overnight ? IbkrTimeInForce.OVERNIGHT_AND_DAY : timeInForce,
    ...(isNotional ? {cashQty: Number(options.size)} : {quantity: Number(options.size)}),
    ...(isLimit ? {price: Number(options.price)} : {}),
  };

  let response = await api.submitOrder(accountId, request);

  const MAX_CONFIRMATIONS = 5;
  for (let attempt = 0; attempt < MAX_CONFIRMATIONS; attempt++) {
    const entry = response[0];

    if (!entry) {
      throw new Error(`IBKR returned an empty response when placing an order for ${pair.asString('/')}.`);
    }

    if (isIbkrOrderSubmitSuccess(entry)) {
      const base: PendingOrder =
        options.type === OrderType.LIMIT
          ? {
              id: entry.order_id,
              pair,
              price: options.price,
              side: options.side,
              size: options.size,
              type: OrderType.LIMIT,
            }
          : {
              id: entry.order_id,
              pair,
              side: options.side,
              size: options.size,
              sizeInCounter: options.sizeInCounter,
              type: OrderType.MARKET,
            };
      return base;
    }

    if (isIbkrOrderReplyMessage(entry)) {
      response = await api.replyToOrderMessage(entry.id, true);
      continue;
    }

    if (isIbkrOrderSubmitError(entry)) {
      throw new Error(`IBKR rejected the order for ${pair.asString('/')}: ${entry.error}`);
    }

    throw new Error(`IBKR returned an unrecognised order response for ${pair.asString('/')}.`);
  }

  throw new Error(
    `IBKR kept asking for confirmation after ${MAX_CONFIRMATIONS} replies when placing an order for ${pair.asString('/')}.`
  );
}
