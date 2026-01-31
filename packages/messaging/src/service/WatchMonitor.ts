import type {Agent, HexString} from '@xmtp/agent-sdk';
import {CurrencyPair, getExchangeClient} from '@typedtrader/exchange';
import {Watch, WatchAttributes} from '../database/models/Watch.js';
import {Account} from '../database/models/Account.js';

interface WatchCheckState {
  lastChecked: number;
}

export class WatchMonitor {
  private agent: Agent;
  private watchStates: Map<number, WatchCheckState> = new Map();

  constructor(agent: Agent) {
    this.agent = agent;
  }

  async checkWatches(): Promise<void> {
    const watches = Watch.findAllOrderedById();
    const now = Date.now();

    for (const watch of watches) {
      const state = this.watchStates.get(watch.id) || {lastChecked: 0};

      // Check if enough time has passed based on watch interval
      if (now - state.lastChecked < watch.intervalMs) {
        continue;
      }

      // Update last checked time
      this.watchStates.set(watch.id, {lastChecked: now});

      try {
        const triggered = await this.checkSingleWatch(watch);
        if (triggered) {
          await this.sendAlert(watch);
          // One-shot: remove after triggering
          Watch.destroy(watch.id);
          this.watchStates.delete(watch.id);
        }
      } catch (error) {
        console.error(`Error checking watch ${watch.id}:`, error);
      }
    }
  }

  private async checkSingleWatch(watch: WatchAttributes): Promise<boolean> {
    const account = Account.findByPk(watch.accountId);
    if (!account) {
      console.warn(`Account ${watch.accountId} not found for watch ${watch.id}`);
      return false;
    }

    // Parse pair
    const commaIndex = watch.pair.indexOf(',');
    const base = watch.pair.slice(0, commaIndex);
    const counter = watch.pair.slice(commaIndex + 1);
    const pair = new CurrencyPair(base, counter);

    const client = getExchangeClient({
      exchangeId: account.exchange,
      apiKey: account.apiKey,
      apiSecret: account.apiSecret,
      isPaper: account.isPaper,
    });

    const smallestInterval = client.getSmallestInterval();
    const candle = await client.getLatestCandle(pair, smallestInterval);
    const currentPrice = typeof candle.close === 'string' ? parseFloat(candle.close) : candle.close;
    const baselinePrice = parseFloat(watch.baselinePrice);
    const thresholdValue = parseFloat(watch.thresholdValue);

    return this.isThresholdTriggered(
      baselinePrice,
      currentPrice,
      watch.thresholdType as 'percent' | 'absolute',
      watch.thresholdDirection as 'up' | 'down',
      thresholdValue
    );
  }

  private isThresholdTriggered(
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

  private async sendAlert(watch: WatchAttributes): Promise<void> {
    const commaIndex = watch.pair.indexOf(',');
    const counter = watch.pair.slice(commaIndex + 1);

    const account = Account.findByPk(watch.accountId);
    if (!account) return;

    // Fetch current price for the alert message
    const base = watch.pair.slice(0, commaIndex);
    const pair = new CurrencyPair(base, counter);

    const client = getExchangeClient({
      exchangeId: account.exchange,
      apiKey: account.apiKey,
      apiSecret: account.apiSecret,
      isPaper: account.isPaper,
    });

    const smallestInterval = client.getSmallestInterval();
    const candle = await client.getLatestCandle(pair, smallestInterval);
    const currentPrice = candle.close;

    const dirSymbol = watch.thresholdDirection === 'up' ? '+' : '-';
    const thresholdDisplay =
      watch.thresholdType === 'percent'
        ? `${dirSymbol}${watch.thresholdValue}%`
        : `${dirSymbol}${watch.thresholdValue} ${counter}`;

    const message = `Price Alert Triggered!\n\nPair: ${watch.pair}\nBaseline: ${watch.baselinePrice} ${counter}\nCurrent: ${currentPrice} ${counter}\nThreshold: ${thresholdDisplay}\n\nThis watch has been automatically removed.`;

    // Send proactive DM using XMTP agent SDK
    const dm = await this.agent.createDmWithAddress(account.ownerAddress as HexString);
    await dm.sendText(message);

    console.log(`Alert sent to ${account.ownerAddress} for watch ${watch.id}`);
  }
}
