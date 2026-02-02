import {CurrencyPair, Exchange, ExchangeCandle, getExchangeClient} from '@typedtrader/exchange';
import {validHex, type Agent} from '@xmtp/agent-sdk';
import {Account} from '../database/models/Account.js';
import {Watch, WatchAttributes} from '../database/models/Watch.js';

interface ActiveSubscription {
  watchId: number;
  topicId: string;
  exchange: Exchange;
}

export class WatchMonitor {
  #agent: Agent;
  #subscriptions: Map<number, ActiveSubscription> = new Map();

  constructor(agent: Agent) {
    this.#agent = agent;
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
      console.warn(`Account "${watch.accountId}" not found for watch "${watch.id}"`);
      return;
    }

    const pair = CurrencyPair.fromString(watch.pair, ',');

    const exchange = getExchangeClient({
      exchangeId: account.exchange,
      apiKey: account.apiKey,
      apiSecret: account.apiSecret,
      isPaper: account.isPaper,
    });

    // Subscribe to candle updates and get the topicId
    const openTimeInISO = watch.createdAt || new Date().toISOString();
    const topicId = await exchange.watchCandles(pair, watch.intervalMs, openTimeInISO);

    // Set up listener for candle events
    exchange.on(topicId, async (candle: ExchangeCandle) => {
      try {
        const currentPrice = parseFloat(candle.close);
        const baselinePrice = parseFloat(watch.baselinePrice);
        const thresholdValue = parseFloat(watch.thresholdValue);

        const triggered = this.#isThresholdTriggered(
          baselinePrice,
          currentPrice,
          watch.thresholdType,
          watch.thresholdDirection,
          thresholdValue
        );

        if (triggered) {
          await this.#sendAlert(watch, currentPrice);
          this.unsubscribeFromWatch(watch.id);
          Watch.destroy(watch.id);
        }
      } catch (error) {
        console.error(`Error processing candle for watch ${watch.id}:`, error);
      }
    });

    this.#subscriptions.set(watch.id, {
      watchId: watch.id,
      topicId,
      exchange,
    });

    console.log(`Subscribed to watch "${watch.id}" for "${watch.pair}".`);
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
      console.log(`Unsubscribed from watch "${watchId}".`);
    }
  }

  #isThresholdTriggered(
    baseline: number,
    current: number,
    type: 'percent' | 'absolute',
    direction: 'up' | 'down',
    threshold: number
  ): boolean {
    if (type === 'percent') {
      const percentChange = ((current - baseline) / baseline) * 100;
      if (direction === 'up') {
        return percentChange >= threshold;
      } else {
        return percentChange <= -threshold;
      }
    } else {
      // absolute
      const absoluteChange = current - baseline;
      if (direction === 'up') {
        return absoluteChange >= threshold;
      } else {
        return absoluteChange <= -threshold;
      }
    }
  }

  async #sendAlert(watch: WatchAttributes, currentPrice: number): Promise<void> {
    const {counter} = CurrencyPair.fromString(watch.pair, ',');

    const account = Account.findByPk(watch.accountId);

    if (!account) {
      console.warn(
        `Account ${watch.accountId} not found when sending alert for watch ${watch.id}. Alert was not delivered.`
      );
      return;
    }
    const dirSymbol = watch.thresholdDirection === 'up' ? '+' : '-';
    const thresholdDisplay =
      watch.thresholdType === 'percent'
        ? `${dirSymbol}${watch.thresholdValue}%`
        : `${dirSymbol}${watch.thresholdValue} ${counter}`;

    const message = `Price Alert Triggered!\n\nPair: ${watch.pair}\nBaseline: ${watch.baselinePrice} ${counter}\nCurrent: ${currentPrice} ${counter}\nThreshold: ${thresholdDisplay}\n\nThis watch has been automatically removed.`;

    // Send proactive DM using XMTP agent SDK
    const dm = await this.#agent.createDmWithAddress(validHex(account.ownerAddress));
    await dm.sendText(message);

    console.log(`Alert sent to ${account.ownerAddress} for watch ${watch.id}`);
  }
}
