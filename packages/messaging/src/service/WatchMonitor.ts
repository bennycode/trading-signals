import {TradingPair, Exchange, ExchangeCandle, getExchangeClient} from '@typedtrader/exchange';
import type {MessagingPlatform} from '../platform/MessagingPlatform.js';
import {Account} from '../database/models/Account.js';
import {Watch, WatchAttributes} from '../database/models/Watch.js';
import {logger} from '../logger.js';

interface ActiveSubscription {
  watchId: number;
  topicId: string;
  exchange: Exchange;
}

export class WatchMonitor {
  #platforms: Map<string, MessagingPlatform>;
  #subscriptions: Map<number, ActiveSubscription> = new Map();

  constructor(platforms: Map<string, MessagingPlatform>) {
    this.#platforms = platforms;
  }

  /**
   * Start monitoring all existing watches via WebSocket subscriptions.
   * Call this once when the application starts.
   */
  async start(): Promise<void> {
    const watches = Watch.findAllOrderedById();
    for (const watch of watches) {
      await this.subscribeToWatch(watch);
    }
  }

  /**
   * Stop all active subscriptions.
   */
  stop(): void {
    for (const subscription of this.#subscriptions.values()) {
      subscription.exchange.unwatchCandles(subscription.topicId);
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

    const exchange = getExchangeClient({
      exchangeId: account.exchange,
      apiKey: account.apiKey,
      apiSecret: account.apiSecret,
      isPaper: account.isPaper,
    });

    // Subscribe to candle updates and get the topicId
    const createdAtDate = watch.createdAt ? new Date(watch.createdAt) : null;
    const openTimeInISO =
      createdAtDate && !isNaN(createdAtDate.getTime()) ? createdAtDate.toISOString() : new Date().toISOString();
    const topicId = await exchange.watchCandles(pair, watch.intervalMs, openTimeInISO);

    // Set up listener for candle events
    exchange.on(topicId, async (candle: ExchangeCandle) => {
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
      exchange,
    });

    logger.info({watchId: watch.id, pair: watch.pair}, 'Subscribed to watch');
  }

  /**
   * Unsubscribe from a watch. Call this when a watch is manually removed.
   */
  unsubscribeFromWatch(watchId: number): void {
    const subscription = this.#subscriptions.get(watchId);
    if (subscription) {
      subscription.exchange.unwatchCandles(subscription.topicId);
      subscription.exchange.removeAllListeners(subscription.topicId);
      this.#subscriptions.delete(watchId);
      logger.info({watchId}, 'Unsubscribed from watch');
    }
  }

  async #sendAlert(watch: WatchAttributes, currentPrice: number): Promise<void> {
    const {counter} = TradingPair.fromString(watch.pair, ',');

    const account = Account.findByPk(watch.accountId);

    if (!account) {
      logger.warn({accountId: watch.accountId, watchId: watch.id}, 'Account not found when sending alert');
      return;
    }
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

    const platformPrefix = account.userId.split(':')[0];
    const platform = this.#platforms.get(platformPrefix);

    if (!platform) {
      logger.warn({platformPrefix, watchId: watch.id}, 'No platform found for alert');
      return;
    }

    await platform.sendMessage(account.userId, message);

    logger.info({userId: account.userId, watchId: watch.id}, 'Alert sent');
  }
}
