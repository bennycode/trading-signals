import Big from 'big.js';
import {OrderPosition, OrderSide, type Balance, type Fill} from './Broker.js';

export interface ExchangeMockBalance {
  available: Big;
  hold: Big;
}

/** Simulated account balances. Mutates the given map, so callers can inspect it directly. */
export class MockBalances {
  readonly #balances: Map<string, ExchangeMockBalance>;

  constructor(balances: Map<string, ExchangeMockBalance>) {
    this.#balances = balances;
  }

  #get(currency: string) {
    let balance = this.#balances.get(currency);
    if (!balance) {
      balance = {available: new Big(0), hold: new Big(0)};
      this.#balances.set(currency, balance);
    }
    return balance;
  }

  hold(currency: string, amount: Big) {
    const balance = this.#get(currency);
    if (balance.available.lt(amount)) {
      throw new Error(
        `Insufficient ${currency} balance: need ${amount.toFixed()}, available ${balance.available.toFixed()}`
      );
    }
    balance.available = balance.available.minus(amount);
    balance.hold = balance.hold.plus(amount);
  }

  #releaseHold(currency: string, amount: Big) {
    const balance = this.#get(currency);
    // Release up to what's on hold (may differ from original hold due to price improvement)
    const releaseAmount = amount.gt(balance.hold) ? balance.hold : amount;
    balance.hold = balance.hold.minus(releaseAmount);
  }

  #addAvailable(currency: string, amount: Big) {
    const balance = this.#get(currency);
    balance.available = balance.available.plus(amount);
  }

  /** Gives back an unfilled order's hold, e.g. on cancel. */
  refund(currency: string, amount: Big) {
    this.#releaseHold(currency, amount);
    this.#addAvailable(currency, amount);
  }

  /** Releases the order's hold and books the fill: base for counter on a BUY, counter for base on a SELL. */
  settle(fill: Fill, heldAmount: Big) {
    const {pair} = fill;
    const size = new Big(fill.size);
    const notional = size.mul(fill.price);

    if (fill.side === OrderSide.SELL) {
      this.#releaseHold(pair.base, heldAmount);
      this.#addAvailable(pair.counter, notional.minus(fill.fee));
      return;
    }

    this.#releaseHold(pair.counter, heldAmount);
    /*
     * The hold was an estimate (limit price, or a pre-fill price for market orders).
     * Settle the difference: refund unspent counter on price improvement, or charge
     * the shortfall when the fill came in above the estimate.
     */
    const refund = heldAmount.minus(notional.plus(fill.fee));
    if (!refund.eq(0)) {
      this.#addAvailable(pair.counter, refund);
    }
    this.#addAvailable(pair.base, size);
  }

  list(): Balance[] {
    return Array.from(this.#balances, ([currency, balance]) => ({
      available: balance.available.toFixed(),
      currency,
      hold: balance.hold.toFixed(),
      position: OrderPosition.LONG,
    }));
  }
}
