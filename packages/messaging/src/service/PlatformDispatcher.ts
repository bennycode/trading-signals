import type {MessagingPlatform} from '../platform/MessagingPlatform.js';
import {Account} from '../database/models/Account.js';
import {logger} from '../logger.js';

/** Platform prefix such as "telegram" */
type PlatformPrefix = string;

/**
 * Resolves the right `MessagingPlatform` for a given user and sends messages.
 *
 * User IDs are namespaced by a platform prefix (e.g. `telegram:123456`).
 */
export class PlatformDispatcher {
  readonly #platforms: Map<PlatformPrefix, MessagingPlatform>;

  constructor(platforms: Map<PlatformPrefix, MessagingPlatform>) {
    this.#platforms = platforms;
  }

  async sendToUser(userId: string, message: string): Promise<boolean> {
    const platformPrefix = userId.split(':')[0];
    const platform = this.#platforms.get(platformPrefix);
    if (!platform) {
      logger.warn({platformPrefix, userId}, 'No platform found to send notification');
      return false;
    }
    await platform.sendMessage(userId, message);
    return true;
  }

  async sendToAccount(accountId: number, message: string): Promise<boolean> {
    const account = Account.findByPk(accountId);
    if (!account) {
      logger.warn({accountId}, 'Account not found to send notification');
      return false;
    }
    return this.sendToUser(account.userId, message);
  }
}
