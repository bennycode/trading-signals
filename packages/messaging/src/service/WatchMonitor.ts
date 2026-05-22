import type {Broker, Candle, MarketDataSource} from '@typedtrader/exchange';
import {TradingPair} from '@typedtrader/exchange';
import {getAccountBrokerClient} from '../broker/getAccountBrokerClient.js';
import {Account} from '../database/models/Account.js';
import type {WatchAttributes} from '../database/models/Watch.js';
import {Watch} from '../database/models/Watch.js';
import {logger} from '../logger.js';
import type {PlatformDispatcher} from './PlatformDispatcher.js';

interface ActiveSubscription {
  watchId: number;
  topicId: string;
  broker: Broker & MarketDataSource;
}

export class WatchMonitor {
  readonly #dispatcher: PlatformDispatcher;
  readonly #subscriptions: Map<number, ActiveSubscription> = new Map();

  constructor(dispatcher: PlatformDispatcher) {
    this.#dispatcher = dispatcher;
  }

  /**
   * Start monitoring all existing watches via WebSocket subscriptions.
   * Call this once when the application starts.
   */
  async start(): Promise<void> {
    const watches = Watch.findAllOrderedById();
    for (const watch of watches) {
      /*
       * Isolate failures: a single misconfigured watch (e.g. a Trading212 account with a
       * missing/invalid market-data source, or a transient auth/network error) must not
       * abort startup for the remaining watches.
       */
      try {
        await this.subscribeToWatch(watch);
        await this.#dispatcher.sendToAccount(watch.accountId, `Watch "${watch.id}" started.`);
      } catch (error) {
        logger.error({err: error, watchId: watch.id, accountId: watch.accountId}, 'Failed to start watch');
      }
    }
  }

  /**
   * Stop all active subscriptions.
   */
  stop(): void {
    for (const subscription of this.#subscriptions.values()) {
      subscription.broker.unwatchCandles(subscription.topicId);
    }
    this.#subscriptions.clear();
  }

  /**
   * Subscribe to a new watch. Call this when a watch is created.
   */
  async subscribeToWatch(watch: WatchAttributes): Promise<void> {
    // Skip if already subscribed
    if (this.#subscriptions.has(watch.id)) {
      return;
    }

    const account = Account.findByPk(watch.accountId);
    if (!account) {
      logger.warn({accountId: watch.accountId, watchId: watch.id}, 'Account not found for watch');
      return;
    }

    const pair = TradingPair.fromString(watch.pair, ',');

    const exchange = getAccountBrokerClient(account);

    // Subscribe to candle updates and get the topicId
    const createdAtDate = watch.createdAt ? new Date(watch.createdAt) : null;
    const openTimeInISO =
      createdAtDate && !isNaN(createdAtDate.getTime()) ? createdAtDate.toISOString() : new Date().toISOString();
    const topicId = await exchange.watchCandles(pair, watch.intervalMs, openTimeInISO);

    // Set up listener for candle events
    exchange.on(topicId, async (candle: Candle) => {
      try {
        const currentPrice = parseFloat(candle.close);
        const alertPrice = parseFloat(watch.alertPrice);

        const triggered = watch.thresholdDirection === 'up' ? currentPrice >= alertPrice : currentPrice <= alertPrice;

        if (triggered) {
          await this.#sendAlert(watch, currentPrice);
          this.unsubscribeFromWatch(watch.id);
          Watch.destroy(watch.id);
        }
      } catch (error) {
        logger.error({err: error, watchId: watch.id}, 'Error processing candle');
      }
    });

    this.#subscriptions.set(watch.id, {
      watchId: watch.id,
      topicId,
      broker: exchange,
    });

    logger.info({watchId: watch.id, pair: watch.pair}, 'Subscribed to watch');
  }

  /**
   * Unsubscribe from a watch. Call this when a watch is manually removed.
   */
  unsubscribeFromWatch(watchId: number): void {
    const subscription = this.#subscriptions.get(watchId);
    if (subscription) {
      subscription.broker.unwatchCandles(subscription.topicId);
      subscription.broker.removeAllListeners(subscription.topicId);
      this.#subscriptions.delete(watchId);
      logger.info({watchId}, 'Unsubscribed from watch');
    }
  }

  /**
   * Restart every active watch subscription bound to an account. Used after the account's
   * credentials change so subscriptions reconnect with the new keys. Watches hold no
   * accumulated state, so the existing subscription is simply torn down and recreated from
   * the freshly loaded row.
   */
  async restartForAccount(accountId: number): Promise<void> {
    const watches = Watch.findByAccountIds([accountId]);
    for (const watch of watches) {
      if (!this.#subscriptions.has(watch.id)) {
        continue;
      }
      try {
        this.unsubscribeFromWatch(watch.id);
        const freshWatch = Watch.findByPk(watch.id);
        if (freshWatch) {
          await this.subscribeToWatch(freshWatch);
        }
        logger.info({watchId: watch.id, accountId}, 'Restarted watch after account update');
      } catch (error) {
        logger.error({err: error, watchId: watch.id, accountId}, 'Failed to restart watch after account update');
      }
    }
  }

  async #sendAlert(watch: WatchAttributes, currentPrice: number): Promise<void> {
    const {counter} = TradingPair.fromString(watch.pair, ',');

    const dirSymbol = watch.thresholdDirection === 'up' ? '+' : '-';
    const thresholdDisplay =
      watch.thresholdType === 'percent'
        ? `${dirSymbol}${watch.thresholdValue}%`
        : `${dirSymbol}${watch.thresholdValue} ${counter}`;

    const baselinePrice = parseFloat(watch.baselinePrice);
    const diff = currentPrice - baselinePrice;
    const diffPercent = ((diff / baselinePrice) * 100).toFixed(2);
    const diffDisplay = `${diff >= 0 ? '+' : ''}${diff.toFixed(2)} ${counter} (${diff >= 0 ? '+' : ''}${diffPercent}%)`;

    const message = `Price Alert Triggered!\n\nPair: ${watch.pair}\nBaseline: ${watch.baselinePrice} ${counter}\nAlert price: ${watch.alertPrice} ${counter}\nCurrent: ${currentPrice} ${counter}\nDiff: ${diffDisplay}\nThreshold: ${thresholdDisplay}\n\nThis watch has been automatically removed.`;

    await this.#dispatcher.sendToAccount(watch.accountId, message);
  }
}
