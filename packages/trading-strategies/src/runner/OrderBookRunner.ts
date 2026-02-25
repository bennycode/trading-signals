import {
  alpacaWebSocket,
  AlpacaExchange,
  ExchangeOrderPosition,
  ExchangeOrderSide,
  TradingPair,
  type AlpacaStreamCredentials,
  type OrderBookQuote,
  type QuoteMessage,
} from '@typedtrader/exchange';
import {StrategySignal} from '../strategy/StrategySignal.js';
import {OrderImbalanceStrategy} from '../strategy-order-imbalance/OrderImbalanceStrategy.js';

type TakeProfitState = {
  closeSide: ExchangeOrderSide;
  entryPrice: number;
  targetPrice: number;
};

export class OrderBookRunner {
  /**
   * Profit target as a fraction of entry price per unit of imbalance.
   * e.g. pct=0.005 + imbalance=0.5 + entry=$100 → target $0.25 above/below entry (0.25%).
   */
  #takeProfit: TakeProfitState | null = null;

  constructor(
    private readonly credentials: AlpacaStreamCredentials,
    private readonly strategy: OrderImbalanceStrategy,
    private readonly exchange: AlpacaExchange,
    private readonly pair: TradingPair,
    private readonly source: string = 'v2/iex',
    private readonly dryRun: boolean = false,
    private readonly profitTargetPct: number = 0.005
  ) {}

  async start(): Promise<void> {
    const connection = await alpacaWebSocket.connect(this.credentials, this.source);
    const symbol = this.pair.base;

    alpacaWebSocket.subscribeToQuotes(connection.connectionId, symbol, async msg => {
      await this.#checkTakeProfit(msg);

      const total = msg.bs + msg.as;
      const quote: OrderBookQuote = {
        symbol: msg.S,
        bidPrice: msg.bp,
        bidSize: msg.bs,
        askPrice: msg.ap,
        askSize: msg.as,
        imbalance: total > 0 ? (msg.bs - msg.as) / total : 0,
        timestamp: msg.t,
      };

      const advice = this.strategy.processQuote(quote);
      if (!advice) {
        return;
      }

      // Don't open a new position while waiting for take profit on an existing one
      if (this.#takeProfit) {
        return;
      }

      const tag = this.dryRun ? '[DRY RUN]' : '';
      console.log(`[${new Date().toISOString()}]${tag} ${advice.signal} — ${advice.reason}`);

      if (this.dryRun) {
        return;
      }

      const balances = await this.exchange.listBalances();
      const position = balances.find(b => b.currency === this.pair.base);
      const isLong = position?.position === ExchangeOrderPosition.LONG;
      const isFlat = !position;

      if (advice.signal === StrategySignal.BUY_MARKET && !isLong) {
        const order = await this.exchange.placeMarketOrder(this.pair, {
          side: ExchangeOrderSide.BUY,
          size: '1',
          sizeInCounter: false,
        });
        const targetDelta = msg.ap * Math.abs(quote.imbalance) * this.profitTargetPct;
        this.#takeProfit = {
          closeSide: ExchangeOrderSide.SELL,
          entryPrice: msg.ap,
          targetPrice: msg.ap + targetDelta,
        };
        console.log(`[${new Date().toISOString()}] BUY placed — entry ~$${msg.ap.toFixed(2)}, TP $${this.#takeProfit.targetPrice.toFixed(2)} (+$${targetDelta.toFixed(3)})`, order.id);
      } else if (advice.signal === StrategySignal.SELL_MARKET && isLong) {
        const order = await this.exchange.placeMarketOrder(this.pair, {
          side: ExchangeOrderSide.SELL,
          size: '1',
          sizeInCounter: false,
        });
        const targetDelta = msg.bp * Math.abs(quote.imbalance) * this.profitTargetPct;
        this.#takeProfit = {
          closeSide: ExchangeOrderSide.BUY,
          entryPrice: msg.bp,
          targetPrice: msg.bp - targetDelta,
        };
        console.log(`[${new Date().toISOString()}] SELL placed — entry ~$${msg.bp.toFixed(2)}, TP $${this.#takeProfit.targetPrice.toFixed(2)} (-$${targetDelta.toFixed(3)})`, order.id);
      } else {
        console.log(`[${new Date().toISOString()}] Skipped (position: ${isFlat ? 'flat' : position!.position} ${position?.available ?? '0'} ${this.pair.base})`);
      }
    });
  }

  async #checkTakeProfit(msg: QuoteMessage): Promise<void> {
    if (!this.#takeProfit) {
      return;
    }

    const {closeSide, entryPrice, targetPrice} = this.#takeProfit;
    const isLongClose = closeSide === ExchangeOrderSide.SELL;

    // Long: we sell when bid reaches target. Short: we buy when ask falls to target.
    const currentExitPrice = isLongClose ? msg.bp : msg.ap;
    const hit = isLongClose ? currentExitPrice >= targetPrice : currentExitPrice <= targetPrice;

    if (!hit) {
      return;
    }

    const pnl = isLongClose ? currentExitPrice - entryPrice : entryPrice - currentExitPrice;
    console.log(`[${new Date().toISOString()}] TP hit — exit ~$${currentExitPrice.toFixed(2)}, P&L ~$${pnl.toFixed(3)}`);

    this.#takeProfit = null;

    if (this.dryRun) {
      return;
    }

    const order = await this.exchange.placeMarketOrder(this.pair, {
      side: closeSide,
      size: '1',
      sizeInCounter: false,
    });
    console.log(`[${new Date().toISOString()}] TP order placed:`, order.id);
  }
}
