import {TradingPair, TradingSession, getBrokerClient} from '@typedtrader/exchange';
import type {Fill} from '@typedtrader/exchange';
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
  row: StrategyAttributes;
}

/** Format a strategy-emitted text into the user-facing message string. Exported for tests. */
export function formatStrategyMessage(strategyName: string, pair: string, text: string): string {
  return `${strategyName} (${pair}): ${text}`;
}

/**
 * Audit interval for the candle-freshness watchdog.
 * Exported so other places (e.g. tests) can reason about it without duplicating the constant.
 */
export const CANDLE_FRESHNESS_AUDIT_INTERVAL_MS = 60_000;

/**
 * When the gap since the last candle exceeds this threshold during a period we'd
 * otherwise expect activity, fire one alert per silent stretch.
 */
export const CANDLE_FRESHNESS_STALE_MS = 15 * 60_000;

/**
 * Upper bound on the staleness we still alert about. Beyond this we assume the
 * pair is simply outside its market hours (overnight, weekend, holiday) and stop
 * warning. Catches the "WS died mid-day" case without spamming on Saturday at 3am.
 */
export const CANDLE_FRESHNESS_GIVE_UP_MS = 8 * 60 * 60_000;

export class StrategyMonitor {
  #platforms: Map<string, MessagingPlatform>;
  #sessions: Map<number, ActiveSession> = new Map();
  #lastCandleAt: Map<number, number> = new Map();
  #freshnessAlertSent: Set<number> = new Set();
  #freshnessAuditInterval: NodeJS.Timeout | null = null;

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

    if (!this.#freshnessAuditInterval) {
      this.#freshnessAuditInterval = setInterval(() => this.#auditCandleFreshness(), CANDLE_FRESHNESS_AUDIT_INTERVAL_MS);
      this.#freshnessAuditInterval.unref();
    }
  }

  /**
   * Stop all active strategy sessions.
   */
  async stop(): Promise<void> {
    if (this.#freshnessAuditInterval) {
      clearInterval(this.#freshnessAuditInterval);
      this.#freshnessAuditInterval = null;
    }

    for (const active of this.#sessions.values()) {
      await active.session.stop({cancelOpenOrders: false});
    }
    this.#sessions.clear();
    this.#lastCandleAt.clear();
    this.#freshnessAlertSent.clear();
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

    const exchange = getBrokerClient({
      exchangeId: account.exchange,
      apiKey: account.apiKey,
      apiSecret: account.apiSecret,
      isPaper: account.isPaper,
    });

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

    // Candle-freshness tracking — clears the alert flag every time a candle arrives,
    // so a transient WS hiccup that resolves itself doesn't leave an unactionable warning.
    session.on('candle', () => {
      this.#lastCandleAt.set(row.id, Date.now());
      this.#freshnessAlertSent.delete(row.id);
    });

    session.on('error', (error: Error) => {
      logger.error({err: error, strategyId: row.id, strategyName: row.strategyName}, 'Strategy error');
    });

    await session.start();

    this.#sessions.set(row.id, {strategyId: row.id, session, strategy, row});
    this.#lastCandleAt.set(row.id, Date.now());
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
      this.#lastCandleAt.delete(strategyId);
      this.#freshnessAlertSent.delete(strategyId);
      logger.info({strategyId}, 'Stopped strategy');
    }
  }

  /**
   * Periodic check that catches the "WebSocket alive but silent" failure mode
   * — the one that twice left an INTC trailing-stop deaf during a US trading day.
   * Fires one Telegram alert per silent stretch (cleared when a candle arrives).
   * Stays quiet beyond {@link CANDLE_FRESHNESS_GIVE_UP_MS} so weekends and overnight
   * gaps don't spam.
   */
  #auditCandleFreshness(): void {
    const now = Date.now();
    for (const [strategyId, lastAt] of this.#lastCandleAt) {
      if (this.#freshnessAlertSent.has(strategyId)) {
        continue;
      }
      const elapsed = now - lastAt;
      if (elapsed > CANDLE_FRESHNESS_STALE_MS && elapsed < CANDLE_FRESHNESS_GIVE_UP_MS) {
        this.#freshnessAlertSent.add(strategyId);
        void this.#sendCandleFreshnessAlert(strategyId, elapsed);
      }
    }
  }

  async #sendCandleFreshnessAlert(strategyId: number, elapsedMs: number): Promise<void> {
    const active = this.#sessions.get(strategyId);
    if (!active) {
      return;
    }
    const minutes = Math.round(elapsedMs / 60_000);
    logger.error({strategyId, elapsedMs}, 'Candle freshness alert');
    const message = `⚠️ Strategy "${active.row.strategyName}" on ${active.row.pair} has not received a candle in ${minutes} minutes. The market-data WebSocket may be stuck — check logs.`;
    try {
      await this.#sendToAccount(active.row, message);
    } catch (error) {
      logger.error({err: error, strategyId}, 'Failed to send candle freshness alert');
    }
  }

  /**
   * Resolve the account + platform for a strategy row and send the message. Centralises
   * the account lookup, prefix-based platform resolution, and warn-on-missing handling
   * that all three notification paths share.
   */
  async #sendToAccount(row: StrategyAttributes, message: string): Promise<void> {
    const account = Account.findByPk(row.accountId);
    if (!account) {
      logger.warn({accountId: row.accountId, strategyId: row.id}, 'Account not found for notification');
      return;
    }

    const platformPrefix = account.userId.split(':')[0];
    const platform = this.#platforms.get(platformPrefix);
    if (!platform) {
      logger.warn({platformPrefix, strategyId: row.id}, 'No platform found for notification');
      return;
    }

    await platform.sendMessage(account.userId, message);

    logger.info({userId: account.userId, strategyId: row.id}, 'Notification sent');
  }

  async #sendFillNotification(row: StrategyAttributes, fill: Fill): Promise<void> {
    const message = `Order Filled!\n\nStrategy: ${row.strategyName}\nPair: ${row.pair}\nSide: ${fill.side}\nPrice: ${fill.price}\nSize: ${fill.size}\nFee: ${fill.fee} ${fill.feeAsset}\nOrder ID: ${fill.order_id}`;
    await this.#sendToAccount(row, message);
  }

  async #sendStrategyMessage(row: StrategyAttributes, text: string): Promise<void> {
    const message = formatStrategyMessage(row.strategyName, row.pair, text);
    await this.#sendToAccount(row, message);
  }

  async #sendFinishNotification(row: StrategyAttributes): Promise<void> {
    const message = `Strategy finished and removed.\n\nID: ${row.id}\nStrategy: ${row.strategyName}\nPair: ${row.pair}`;
    await this.#sendToAccount(row, message);
  }
}
