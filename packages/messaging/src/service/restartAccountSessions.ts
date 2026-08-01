import type {StrategyMonitorPort, WatchMonitorPort} from '../platform/MessagingPlatform.js';

/**
 * Restart every watch and strategy bound to an account so live sessions reconnect with the
 * account's updated credentials. Strategies persist their state before stopping; watches are
 * stateless and simply re-subscribed.
 */
export async function restartAccountSessions(
  accountId: number,
  strategyMonitor: StrategyMonitorPort | undefined,
  watchMonitor: WatchMonitorPort | undefined
): Promise<void> {
  await strategyMonitor?.restartForAccount(accountId);
  await watchMonitor?.restartForAccount(accountId);
}
