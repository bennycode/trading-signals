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

  let response = await submitOrAnnotate(() => api.submitOrder(accountId, request), request.cOID, pair);

  /*
   * One more response is read than there are replies to send: the answer to the last allowed
   * reply still has to be inspected, or an order IBKR accepted on that reply is reported as a
   * failure. Since `submitOrder` is deliberately not retried, the caller would then place it
   * again and hold two positions.
   */
  const MAX_CONFIRMATIONS = 5;
  for (let repliesSent = 0; repliesSent <= MAX_CONFIRMATIONS; repliesSent++) {
    if (response.length === 0) {
      throw new Error(`IBKR returned an empty response when placing an order for ${pair.asString('/')}.`);
    }

    /*
     * The whole array is examined rather than just its first entry, because IBKR can answer with
     * several: two prompts at once, or a prompt next to a rejection. The precedence below is what
     * keeps a mixed answer from being misread.
     *
     * A rejection wins: there is no order to confirm, so answering a sibling prompt would only
     * send a reply for something IBKR has already refused.
     */
    const rejection = response.find(isIbkrOrderSubmitError);
    if (rejection) {
      throw new Error(`IBKR rejected the order for ${pair.asString('/')}: ${rejection.error}`);
    }

    /*
     * A prompt comes before a success: until every prompt is answered the order does not exist,
     * and each reply returns whatever is still outstanding, so the loop drains them one per turn.
     */
    const prompt = response.find(isIbkrOrderReplyMessage);
    if (prompt) {
      if (repliesSent === MAX_CONFIRMATIONS) {
        break;
      }
      response = await submitOrAnnotate(() => api.replyToOrderMessage(prompt.id, true), request.cOID, pair);
      continue;
    }

    const accepted = response.find(isIbkrOrderSubmitSuccess);
    if (accepted) {
      return options.type === OrderType.LIMIT
        ? {
            id: accepted.order_id,
            pair,
            price: options.price,
            side: options.side,
            size: options.size,
            type: OrderType.LIMIT,
          }
        : {
            id: accepted.order_id,
            pair,
            side: options.side,
            size: options.size,
            sizeInCounter: options.sizeInCounter,
            type: OrderType.MARKET,
          };
    }

    throw new Error(`IBKR returned an unrecognised order response for ${pair.asString('/')}.`);
  }

  throw new Error(
    `IBKR kept asking for confirmation after ${MAX_CONFIRMATIONS} replies when placing an order for ${pair.asString('/')}.`
  );
}

/**
 * Raised when a submission neither succeeded nor was refused, so whether an order exists is
 * unknown.
 *
 * It carries the `cOID` because that is the only handle on the order IBKR may have created:
 * `simplifyError` strips Axios's request config from the thrown error, so without this the id
 * generated above dies with the call and the reconciliation it exists for is impossible. A caller
 * looks the order up by {@link clientOrderId} instead of resubmitting into a possible double fill.
 */
export class IbkrAmbiguousOrderError extends Error {
  readonly clientOrderId: string | undefined;

  constructor(input: {cause: unknown; clientOrderId: string | undefined; pair: string}) {
    const reason = input.cause instanceof Error ? input.cause.message : String(input.cause);
    super(
      `IBKR did not say whether the order for ${input.pair} was placed: ${reason}. Look it up by client order id ${input.clientOrderId ?? '(none generated)'} before placing it again.`
    );
    this.name = 'IbkrAmbiguousOrderError';
    this.clientOrderId = input.clientOrderId;
    this.cause = input.cause;
  }
}

async function submitOrAnnotate<T>(
  send: () => Promise<T>,
  clientOrderId: string | undefined,
  pair: TradingPair
): Promise<T> {
  try {
    return await send();
  } catch (error) {
    throw new IbkrAmbiguousOrderError({cause: error, clientOrderId, pair: pair.asString('/')});
  }
}
