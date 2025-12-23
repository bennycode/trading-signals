/* @see https://github.com/alpacahq/alpaca-ts/issues/106#issuecomment-1165948375 */
import { AlpacaExchange } from "./AlpacaExchange.js";

export function getAlpacaClient({
  apiKey,
  apiSecret,
  usePaperTrading,
}: {
  apiKey: string;
  apiSecret: string;
  usePaperTrading: boolean;
}) {
  process.on("SIGINT", () => {
    console.log("Received signal interrupt...");
    exchange.disconnect();
    console.log(`Sent WebSocket disconnect.`);
    process.exit(0);
  });

  const exchange = new AlpacaExchange({
    apiKey,
    apiSecret,
    usePaperTrading,
  });

  return exchange;
}
