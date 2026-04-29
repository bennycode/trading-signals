import {TradingPair, TradingSession, getExchangeClient} from '@typedtrader/exchange';
import type {ExchangeFill} from '@typedtrader/exchange';
import {createStrategy} from 'trading-strategies';
import type {Strategy as TradingStrategy} from 'trading-strategies';
import type {MessagingPlatform} from '../platform/MessagingPlatform.js';
import {Account} from '../database/models/Account.js';
import {Strategy, type StrategyAttributes} from '../database/models/Strategy.js';
import {logger} from '../logger.js';

interface ActiveSession {
  strategyId: number;
  session: TradingSession;
  strategy: TradingStrategy;
}

/** Format a strategy-emitted text into the user-facing message string. Exported for tests. */
export function formatStrategyMessage(strategyName: string, pair: string, text: string): string {
  return `${strategyName} (${pair}): ${text}`;
}

export class StrategyMonitor {
  #platforms: Map<string, MessagingPlatform>;
  #sessions: Map<number, ActiveSession> = new Map();

  constructor(platforms: Map<string, MessagingPlatform>) {
    this.#platforms = platforms;
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
        if (strategy.state) {
          Strategy.updateState(row.id, JSON.stringify(strategy.state));
        }
        if (strategy.config) {
          Strategy.updateConfig(row.id, JSON.stringify(strategy.config));
        }
      });
    };

    // Auto-remove when the strategy signals it is terminally done (e.g. the kill-switch
    // sell has fully filled). Cancel any still-open orders on the way out so we don't
    // leave stray limit orders (e.g. a retried kill-switch order) behind on the exchange.
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

    session.on('fill', async (fill: ExchangeFill) => {
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
      logger.error({err: error, strategyId: row.id, strategyName: row.strategyName}, 'Strategy error');
    });

    await session.start();

    this.#sessions.set(row.id, {strategyId: row.id, session, strategy});
    logger.info({strategyId: row.id, strategyName: row.strategyName, pair: row.pair}, 'Started strategy');
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
   * Resolve the account + platform for a strategy row, send the message, and log the
   * outcome under `label`. Centralises the account lookup, prefix-based platform
   * resolution, and warn-on-missing handling that all three notification paths share.
   *
   * `level` controls only the success log line — strategy messages can fire frequently,
   * so they default to `debug` to keep production logs quiet, while fill/finish events
   * stay at `info`.
   */
  async #sendToAccount(
    row: StrategyAttributes,
    message: string,
    label: string,
    level: 'info' | 'debug' = 'info'
  ): Promise<void> {
    const account = Account.findByPk(row.accountId);
    if (!account) {
      logger.warn({accountId: row.accountId, strategyId: row.id}, `Account not found for ${label}`);
      return;
    }

    const platformPrefix = account.userId.split(':')[0];
    const platform = this.#platforms.get(platformPrefix);
    if (!platform) {
      logger.warn({platformPrefix, strategyId: row.id}, `No platform found for ${label}`);
      return;
    }

    await platform.sendMessage(account.userId, message);

    logger[level]({userId: account.userId, strategyId: row.id}, `${label} sent`);
  }

  async #sendFillNotification(row: StrategyAttributes, fill: ExchangeFill): Promise<void> {
    const message = `Order Filled!\n\nStrategy: ${row.strategyName}\nPair: ${row.pair}\nSide: ${fill.side}\nPrice: ${fill.price}\nSize: ${fill.size}\nFee: ${fill.fee} ${fill.feeAsset}\nOrder ID: ${fill.order_id}`;
    await this.#sendToAccount(row, message, 'Fill notification', 'info');
  }

  async #sendStrategyMessage(row: StrategyAttributes, text: string): Promise<void> {
    const message = formatStrategyMessage(row.strategyName, row.pair, text);
    await this.#sendToAccount(row, message, 'Strategy message', 'debug');
  }

  async #sendFinishNotification(row: StrategyAttributes): Promise<void> {
    const message = `Strategy finished and removed.\n\nID: ${row.id}\nStrategy: ${row.strategyName}\nPair: ${row.pair}`;
    await this.#sendToAccount(row, message, 'Finish notification', 'info');
  }
}
