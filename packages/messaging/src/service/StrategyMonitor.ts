import {TradingPair, TradingSession} from '@typedtrader/exchange';
import type {Fill} from '@typedtrader/exchange';
import {createStrategy} from 'trading-strategies';
import type {Strategy as TradingStrategy} from 'trading-strategies';
import {getAccountBrokerClient} from '../broker/getAccountBrokerClient.js';
import {Account} from '../database/models/Account.js';
import {Strategy, type StrategyAttributes} from '../database/models/Strategy.js';
import {logger} from '../logger.js';
import type {PlatformDispatcher} from './PlatformDispatcher.js';

interface ActiveSession {
  strategyId: number;
  session: TradingSession;
  strategy: TradingStrategy;
}

/** Pino log message used when a session surfaces an unrecoverable error. Exported for tests. */
export const STRATEGY_ERROR_LOG_MESSAGE = 'Strategy error';

/** Format a strategy-emitted text into the user-facing message string. Exported for tests. */
export function formatStrategyMessage(strategyName: string, pair: string, text: string): string {
  return `${strategyName} (${pair}): ${text}`;
}

export class StrategyMonitor {
  readonly #dispatcher: PlatformDispatcher;
  readonly #sessions: Map<number, ActiveSession> = new Map();

  constructor(dispatcher: PlatformDispatcher) {
    this.#dispatcher = dispatcher;
  }

  /**
   * Start all persisted strategies. Call once on application startup.
   */
  async start(): Promise<void> {
    const rows = Strategy.findAllOrderedById();
    for (const row of rows) {
      try {
        await this.subscribeToStrategy(row);
        await this.#dispatcher.sendToAccount(row.accountId, `Strategy "${row.id}" started.`);
      } catch (error) {
        logger.error({err: error, strategyId: row.id, strategyName: row.strategyName}, 'Failed to start strategy');
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
      logger.warn({accountId: row.accountId, strategyId: row.id}, 'Account not found for strategy');
      return;
    }

    const pair = TradingPair.fromString(row.pair, ',');
    const config = JSON.parse(row.config);

    const strategy = createStrategy(row.strategyName, config);

    // Restore persisted state if available
    if (row.state) {
      const persisted: Record<string, unknown> = JSON.parse(row.state);
      strategy.restoreState(persisted);
    }

    const exchange = getAccountBrokerClient(account);

    const session = new TradingSession({
      broker: exchange,
      pair,
      strategy,
    });

    // Wire up auto-persistence via onSave (after restore, before start)
    let pendingSave = false;
    strategy.onSave = () => {
      if (pendingSave) {
        return;
      }
      pendingSave = true;
      queueMicrotask(() => {
        pendingSave = false;
        this.#persistStrategy(row.id, strategy);
      });
    };

    /*
     * Auto-remove when the strategy signals it is terminally done (e.g. the kill-switch
     * sell has fully filled). Cancel any still-open orders on the way out so we don't
     * leave stray limit orders (e.g. a retried kill-switch order) behind on the exchange.
     */
    strategy.onFinish = async () => {
      try {
        await session.stop({cancelOpenOrders: true});
        this.#sessions.delete(row.id);
        Strategy.destroy(row.id);
        await this.#sendFinishNotification(row);
      } catch (error) {
        logger.error({err: error, strategyId: row.id}, 'Error auto-removing finished strategy');
      }
    };

    session.on('fill', async (fill: Fill) => {
      try {
        await this.#sendFillNotification(row, fill);
      } catch (error) {
        logger.error({err: error, strategyId: row.id}, 'Error handling fill');
      }
    });

    session.on('message', async (text: string) => {
      try {
        await this.#sendStrategyMessage(row, text);
      } catch (error) {
        logger.error({err: error, strategyId: row.id}, 'Error handling strategy message');
      }
    });

    session.on('error', (error: Error) => {
      void this.#handleSessionError(row, error);
    });

    await session.start();

    this.#sessions.set(row.id, {session, strategy, strategyId: row.id});
    logger.info({pair: row.pair, strategyId: row.id, strategyName: row.strategyName}, 'Started strategy');
  }

  /**
   * Stop and remove a strategy session.
   */
  async unsubscribeFromStrategy(strategyId: number): Promise<void> {
    const active = this.#sessions.get(strategyId);
    if (active) {
      await active.session.stop({cancelOpenOrders: true});
      this.#sessions.delete(strategyId);
      logger.info({strategyId}, 'Stopped strategy');
    }
  }

  /**
   * Restart every active strategy session bound to an account. Used after the account's
   * credentials change so live sessions reconnect with the new keys. Each session persists
   * its strategy state, stops without cancelling open orders, then re-subscribes from the
   * freshly loaded row.
   */
  async restartForAccount(accountId: number): Promise<void> {
    const rows = Strategy.findByAccountIds([accountId]);
    for (const row of rows) {
      const active = this.#sessions.get(row.id);
      if (!active) {
        continue;
      }
      try {
        this.#persistStrategy(row.id, active.strategy);
        await active.session.stop({cancelOpenOrders: false});
        this.#sessions.delete(row.id);

        const freshRow = Strategy.findByPk(row.id);
        if (freshRow) {
          await this.subscribeToStrategy(freshRow);
        }
        logger.info({accountId, strategyId: row.id}, 'Restarted strategy after account update');
      } catch (error) {
        logger.error({accountId, err: error, strategyId: row.id}, 'Failed to restart strategy after account update');
      }
    }
  }

  /**
   * Stop a strategy after an unrecoverable session error: cancel any open orders so nothing
   * is left live on the exchange, drop it from the active sessions, and alert the user. The
   * persisted row is kept on purpose so the user can fix the cause and restart it. Guarded so
   * repeated `'error'` events only tear the session down once.
   */
  async #handleSessionError(row: StrategyAttributes, error: Error): Promise<void> {
    logger.error({err: error, strategyId: row.id, strategyName: row.strategyName}, STRATEGY_ERROR_LOG_MESSAGE);

    const active = this.#sessions.get(row.id);
    if (!active) {
      return;
    }
    this.#sessions.delete(row.id);

    try {
      await active.session.stop({cancelOpenOrders: true});
    } catch (stopError) {
      logger.error({err: stopError, strategyId: row.id}, 'Error stopping strategy after failure');
    }

    try {
      await this.#sendErrorNotification(row, error);
    } catch (notifyError) {
      logger.error({err: notifyError, strategyId: row.id}, 'Error notifying user of strategy failure');
    }

    logger.info({strategyId: row.id, strategyName: row.strategyName}, 'Stopped strategy after error');
  }

  #persistStrategy(strategyId: number, strategy: TradingStrategy): void {
    if (strategy.state) {
      Strategy.updateState(strategyId, JSON.stringify(strategy.state));
    }
    if (strategy.config) {
      Strategy.updateConfig(strategyId, JSON.stringify(strategy.config));
    }
  }

  async #sendFillNotification(row: StrategyAttributes, fill: Fill): Promise<void> {
    const message = `Order Filled!\n\nStrategy: ${row.strategyName}\nPair: ${row.pair}\nSide: ${fill.side}\nPrice: ${fill.price}\nSize: ${fill.size}\nFee: ${fill.fee} ${fill.feeAsset}\nOrder ID: ${fill.order_id}`;
    await this.#dispatcher.sendToAccount(row.accountId, message);
  }

  async #sendStrategyMessage(row: StrategyAttributes, text: string): Promise<void> {
    const message = formatStrategyMessage(row.strategyName, row.pair, text);
    await this.#dispatcher.sendToAccount(row.accountId, message);
  }

  async #sendFinishNotification(row: StrategyAttributes): Promise<void> {
    const message = `Strategy finished and removed.\n\nID: ${row.id}\nStrategy: ${row.strategyName}\nPair: ${row.pair}`;
    await this.#dispatcher.sendToAccount(row.accountId, message);
  }

  async #sendErrorNotification(row: StrategyAttributes, error: Error): Promise<void> {
    const message = `Strategy stopped due to an error.\n\nID: ${row.id}\nStrategy: ${row.strategyName}\nPair: ${row.pair}\nError: ${error.message}\n\nFix the cause and restart it when ready.`;
    await this.#dispatcher.sendToAccount(row.accountId, message);
  }
}
