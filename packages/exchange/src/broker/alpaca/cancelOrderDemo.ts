import 'dotenv-defaults/config';
import {AlpacaAPI} from './api/AlpacaAPI.js';

const api = new AlpacaAPI({
  apiKey: process.env.ALPACA_LIVE_API_KEY ?? '',
  apiSecret: process.env.ALPACA_LIVE_API_SECRET ?? '',
  usePaperTrading: false,
});

console.log(process.env.ALPACA_LIVE_API_KEY, process.env.ALPACA_LIVE_API_SECRET);

const orderId = 'c049bfd6-c545-4f85-bf8b-14c9f340d8d4';

try {
  const resp = await api.deleteOrder(orderId);
  console.log(`[deleteOrder] Cancelled order ${orderId}`, resp);
} catch (error) {
  console.error('[deleteOrder] Failed to cancel order:');
  console.log(error);
  process.exitCode = 1;
}
