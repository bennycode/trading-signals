import 'dotenv-defaults/config';
import {AlpacaAPI} from './api/AlpacaAPI.js';

const api = new AlpacaAPI({
  apiKey: process.env.ALPACA_PAPER_API_KEY ?? '',
  apiSecret: process.env.ALPACA_PAPER_API_SECRET ?? '',
  usePaperTrading: true,
});

const orderId = 'c049bfd6-c545-4f85-bf8b-14c9f340d8d4';

try {
  await api.deleteOrder(orderId);
  console.log(`[deleteOrder] Cancelled order ${orderId}`);
} catch (error) {
  console.error('[deleteOrder] Failed to cancel order:');
  console.error(error);
  process.exitCode = 1;
}
