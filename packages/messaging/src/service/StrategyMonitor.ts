import {TradingPair, TradingSession, getExchangeClient} from '@typedtrader/exchange';
import type {ExchangeFill} from '@typedtrader/exchange';
import {createStrategy} from 'trading-strategies';
import type {Strategy as TradingStrategy} from 'trading-strategies';
import {validHex, type Agent} from '@xmtp/agent-sdk';
import {Account} from '../database/models/Account.js';
import {Strategy, type StrategyAttributes} from '../database/models/Strategy.js';

interface ActiveSession {
  strategyId: number;
  session: TradingSession;
  strategy: TradingStrategy;
}

export class StrategyMonitor {
  #agent: Agent;
  #sessions: Map<number, ActiveSession> = new Map();

  constructor(agent: Agent) {
    this.#agent = agent;
  }

  /**
   * Start all persisted strategies. Call once on application startup.
   */
  async start(): Promise<void> {
    const rows = Strategy.findAllOrderedById();
    for (const row of rows) {
      try {
        await this.subscribeToStrategy(row);
      } catch (error) {
        console.error(`Failed to start strategy ${row.id} (${row.strategyName}):`, error);
      }
    }
  }

  /**
   * Stop all active strategy sessions.
   */
  async stop(): Promise<void> {
    for (const active of this.#sessions.values()) {
      await active.session.stop({cancelOpenOrders: false});
    }
    this.#sessions.clear();
  }

  /**
   * Start a new TradingSession for a persisted strategy row.
   */
  async subscribeToStrategy(row: StrategyAttributes): Promise<void> {
    if (this.#sessions.has(row.id)) {
      return;
    }

    const account = Account.findByPk(row.accountId);
    if (!account) {
      console.warn(`Account "${row.accountId}" not found for strategy "${row.id}"`);
      return;
    }

    const pair = TradingPair.fromString(row.pair, ',');
    const config = JSON.parse(row.config);

    const strategy = createStrategy(row.strategyName, config);

    // Restore persisted state if available
    if (row.state) {
      const persisted = JSON.parse(row.state);
      strategy.restoreState(persisted);
    }

    const exchange = getExchangeClient({
      exchangeId: account.exchange,
      apiKey: account.apiKey,
      apiSecret: account.apiSecret,
      isPaper: account.isPaper,
    });

    const session = new TradingSession({
      exchange,
      pair,
      strategy,
      candleInterval: row.intervalMs,
    });

    session.on('fill', async (fill: ExchangeFill) => {
      try {
        // Persist strategy state after fill
        if (strategy.state) {
          Strategy.updateState(row.id, JSON.stringify(strategy.state));
        }
        await this.#sendFillNotification(row, fill);
      } catch (error) {
        console.error(`Error handling fill for strategy ${row.id}:`, error);
      }
    });

    session.on('advice', () => {
      // Persist strategy state after advice (state may have changed)
      if (strategy.state) {
        Strategy.updateState(row.id, JSON.stringify(strategy.state));
      }
    });

    session.on('error', (error: Error) => {
      console.error(`Strategy ${row.id} (${row.strategyName}) error:`, error.message);
    });

    await session.start();

    this.#sessions.set(row.id, {strategyId: row.id, session, strategy});
    console.log(`Started strategy "${row.id}" (${row.strategyName}) for "${row.pair}".`);
  }

  /**
   * Stop and remove a strategy session.
   */
  async unsubscribeFromStrategy(strategyId: number): Promise<void> {
    const active = this.#sessions.get(strategyId);
    if (active) {
      await active.session.stop({cancelOpenOrders: true});
      this.#sessions.delete(strategyId);
      console.log(`Stopped strategy "${strategyId}".`);
    }
  }

  async #sendFillNotification(row: StrategyAttributes, fill: ExchangeFill): Promise<void> {
    const account = Account.findByPk(row.accountId);
    if (!account) {
      console.warn(`Account "${row.accountId}" not found for fill notification on strategy "${row.id}".`);
      return;
    }

    const message = `Order Filled!\n\nStrategy: ${row.strategyName}\nPair: ${row.pair}\nSide: ${fill.side}\nPrice: ${fill.price}\nSize: ${fill.size}\nFee: ${fill.fee} ${fill.feeAsset}`;

    const dm = await this.#agent.createDmWithAddress(validHex(account.ownerAddress));
    await dm.sendText(message);

    console.log(`Fill notification sent to ${account.ownerAddress} for strategy ${row.id}`);
  }
}
