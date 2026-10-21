import assert from 'node:assert/strict';
import {Trading212API} from './api/Trading212API.js';
import {Trading212TimeValidity, type Order, type PlaceStopOrderRequest} from './api/schema/OrderSchema.js';

interface StopLossPosition {
  averagePrice: number;
  currentPrice: number;
  quantity: number;
  ticker: string;
}

/**
 * Turns a long position into the sell-stop that caps its loss at `dropPercent` below the average
 * entry. Refuses a stop that sits at or above the current price, because Trading212 would trigger
 * it on the spot and turn the safety net into a market sell.
 */
export function toStopLossOrder(position: StopLossPosition, dropPercent: number): PlaceStopOrderRequest {
  assert.ok(position.quantity > 0, `No long position in ${position.ticker} to protect`);
  assert.ok(dropPercent > 0 && dropPercent < 100, `Drop must be a percentage between 0 and 100, got ${dropPercent}`);

  const stopPrice = Math.round(position.averagePrice * (1 - dropPercent / 100) * 100) / 100;

  assert.ok(
    stopPrice < position.currentPrice,
    `Stop ${stopPrice} is at or above the current price ${position.currentPrice} and would sell immediately`
  );

  return {
    quantity: -position.quantity,
    stopPrice,
    ticker: position.ticker,
    timeValidity: Trading212TimeValidity.GOOD_TILL_CANCEL,
  };
}

export function findOwnStops(orders: Order[], ticker: string): Order[] {
  return orders.filter(order => order.ticker === ticker && order.type === 'STOP');
}

/**
 * Places the stop loss for one position, cancelling any stop already resting on that ticker so
 * repeated runs don't stack duplicates. `GOOD_TILL_CANCEL` keeps the order alive until it fills
 * or is cancelled, so it needs no renewal between sessions.
 */
export async function placeStopLoss(api: Trading212API, ticker: string, dropPercent: number) {
  const position = await api.getPositionByTicker(ticker);
  const request = toStopLossOrder({...position, ticker}, dropPercent);

  for (const stale of findOwnStops(await api.getOrders(), ticker)) {
    await api.cancelOrder(stale.id);
  }

  return api.placeStopOrder(request);
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const live = args.includes('--live');
  const [ticker, dropPercent = '10'] = args.filter(arg => arg !== '--live');
  assert.ok(ticker, 'Usage: placeStopLoss <TICKER> [dropPercent] [--live]');

  const prefix = `TRADING212_${live ? 'LIVE' : 'PAPER'}`;
  const apiKey = process.env[`${prefix}_API_KEY`];
  const apiSecret = process.env[`${prefix}_API_SECRET`];
  assert.ok(apiKey && apiSecret, `Missing ${prefix}_API_KEY and/or ${prefix}_API_SECRET in environment`);

  const api = new Trading212API({apiKey, apiSecret, usePaperTrading: !live});
  const order = await placeStopLoss(api, ticker, Number(dropPercent));

  console.log(`[${live ? 'LIVE' : 'PAPER'}] ${ticker} stop loss at -${dropPercent}%:`, {
    id: order.id,
    quantity: order.quantity,
    stopPrice: order.stopPrice,
  });
}
