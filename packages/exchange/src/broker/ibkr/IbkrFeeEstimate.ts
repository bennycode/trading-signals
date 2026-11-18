import Big from 'big.js';
import type {TradingPair} from '../TradingPair.js';
import type {IbkrAPI} from './api/IbkrAPI.js';
import {IbkrOrderSide, IbkrOrderType, IbkrTimeInForce} from './api/schema/OrderSchema.js';
import {ibkrCommissionFor, parseIbkrCommission} from './IbkrFees.js';

/**
 * What an order would cost, asked of IBKR itself.
 *
 * `whatif` prices the exact ticket, which removes any need to model the schedule, its per-order
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
}): Promise<{commission: Big; currencyConversion: Big; feeAsset: string; total: Big}> {
  const {api, feeAsset, getAccountId, getConid, getLatestClose, notional, pair} = input;

  try {
    const [accountId, conid] = await Promise.all([getAccountId(), getConid(pair)]);
    const preview = await api.previewOrder(accountId, {
      cashQty: Number(notional.toString()),
      conid,
      /*
       * Always previewed as a MARKET ticket, even when pricing a LIMIT order. `whatif` rejects a
       * LIMIT ticket that carries no `price` with "Invalid order price fields", and a fee
       * estimate has no limit price to offer. Asking as MARKET costs nothing in accuracy because
       * IBKR bills the same per-share commission either way, which is why `getFeeRates` reports
       * one rate for both.
       */
      orderType: IbkrOrderType.MARKET,
      side: IbkrOrderSide.BUY,
      tif: IbkrTimeInForce.DAY,
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
   */
  const candle = await getLatestClose();
  const commission = ibkrCommissionFor(notional, candle);

  return {commission, currencyConversion: new Big(0), feeAsset, total: commission};
}
