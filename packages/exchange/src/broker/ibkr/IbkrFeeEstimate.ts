import Big from 'big.js';
import type {FeeEstimateOrder} from '../Broker.js';
import type {TradingPair} from '../TradingPair.js';
import type {IbkrAPI} from './api/IbkrAPI.js';
import {IbkrOrderSide, IbkrOrderType, IbkrTimeInForce} from './api/schema/OrderSchema.js';
import {ibkrCommissionFor, parseIbkrCommission} from './IbkrFees.js';

/**
 * What an order would cost, asked of IBKR itself.
 *
 * `whatif` prices the exact order, which removes any need to model the schedule, its per-order
 * floor and its 1% cap. The local schedule is the fallback for when there is no session to ask,
 * such as a backtest.
 */
export async function estimateIbkrFee(input: {
  api: IbkrAPI;
  feeAsset: string;
  getAccountId: () => Promise<string>;
  getConid: (pair: TradingPair) => Promise<number>;
  getLatestClose: () => Promise<Big>;
  notional: Big;
  pair: TradingPair;
  /**
   * The order being priced, when the caller knows it. IBKR bills per share, so the share count is what
   * sets the commission, and a notional alone only yields one after dividing by some price.
   */
  order?: FeeEstimateOrder | undefined;
}): Promise<{commission: Big; currencyConversion: Big; feeAsset: string; total: Big}> {
  const {api, feeAsset, getAccountId, getConid, getLatestClose, notional, order, pair} = input;

  /*
   * The caller's own size and price whenever it has them, because the alternative is wrong rather
   * than merely imprecise: previewing a notional as `cashQty` asks IBKR to price whatever number
   * of shares that buys at the *current* quote. Closing 1,000 shares at a target of 100 while the
   * market sits at 200 previews 500 shares and estimates half the commission. Equal MARKET and
   * LIMIT schedules do not make different quantities equivalent.
   */
  const size = order?.size;
  const price = order?.price;

  try {
    const [accountId, conid] = await Promise.all([getAccountId(), getConid(pair)]);
    const preview = await api.previewOrder(accountId, {
      conid,
      side: IbkrOrderSide.BUY,
      tif: IbkrTimeInForce.DAY,
      ...(size && price
        ? {orderType: IbkrOrderType.LIMIT, price: Number(price.toString()), quantity: Number(size.toString())}
        : /*
           * Without a size there is no quantity to send, so the notional goes as `cashQty` and
           * the type has to be MARKET: `whatif` refuses a LIMIT order carrying no price with
           * "Invalid order price fields", and that throw used to be swallowed into the local
           * fallback, reporting a guess as IBKR's own number.
           */
          {cashQty: Number(notional.toString()), orderType: IbkrOrderType.MARKET}),
    });

    const value = parseIbkrCommission(preview.amount?.commission);
    if (value) {
      return {commission: value, currencyConversion: new Big(0), feeAsset, total: value};
    }
  } catch {
    // Fall through to the local estimate below.
  }

  /*
   * No session, so the schedule is applied locally. Deliberately not `super.estimateFee`, which
   * multiplies the notional by a flat rate: IBKR's floor and cap dominate a small order, and a
   * rate alone priced one Ford share at USD 0.005 against the 0.12 actually charged.
   *
   * The candidate price is used when there is one, for the same reason the preview uses it: the
   * latest close prices a different number of shares than the order being estimated.
   */
  const referencePrice = price ?? (await getLatestClose());
  const commission = ibkrCommissionFor(size ? size.mul(referencePrice) : notional, referencePrice);

  return {commission, currencyConversion: new Big(0), feeAsset, total: commission};
}
