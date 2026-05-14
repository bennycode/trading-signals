import {getBrokerClient} from '@typedtrader/exchange';
import {Account} from '../../database/models/Account.js';
import {logger} from '../../logger.js';
import {inlineKeyboard, type InlineButton, type WizardContext, type WizardConversation} from './shared.js';

export interface AccountEditWizardArgs {
  userId: string;
}

export function makeAccountEditWizard() {
  return async function accountEditWizard(
    conversation: WizardConversation,
    ctx: WizardContext,
    args: AccountEditWizardArgs
  ): Promise<void> {
    const accounts = await conversation.external(() => Account.findByUserId(args.userId));

    if (accounts.length === 0) {
      await ctx.reply('No account found. Use /accountAdd first.');
      return;
    }

    const accountButtons: InlineButton[][] = accounts.map(account => [
      {
        text: `${account.name} (${account.exchange}, ${account.isPaper ? 'Paper' : 'Live'})`,
        callback_data: `accountedit:acc:${account.id}`,
      },
    ]);
    await ctx.reply('Pick an account to update:', inlineKeyboard(accountButtons));

    const accountCb = await conversation.waitForCallbackQuery(accounts.map(a => `accountedit:acc:${a.id}`));
    await accountCb.answerCallbackQuery();
    const selectedId = typeof accountCb.match === 'string' ? parseInt(accountCb.match.split(':')[2], 10) : accounts[0].id;
    const account = accounts.find(a => a.id === selectedId) ?? accounts[0];

    // The account ID, name, exchange and paper mode are kept — only the
    // credentials change, so all linked watches, strategies and reports stay intact.
    await accountCb.editMessageText(
      `Account: ${account.name}\n\nSend the new API key (the message will be deleted after receipt):`
    );
    const apiKeyCtx = await conversation.waitFor('message:text');
    const apiKey = apiKeyCtx.msg.text.trim();
    const apiKeyChatId = apiKeyCtx.msg.chat.id;
    const apiKeyMessageId = apiKeyCtx.msg.message_id;
    if (apiKey.startsWith('/')) {
      await ctx.api.deleteMessage(apiKeyChatId, apiKeyMessageId).catch(() => {});
      await ctx.reply('Wizard cancelled. Resend your command to start fresh.');
      return;
    }

    await ctx.reply('Send the new API secret (the message will be deleted after receipt):');
    const apiSecretCtx = await conversation.waitFor('message:text');
    const apiSecret = apiSecretCtx.msg.text.trim();
    const apiSecretChatId = apiSecretCtx.msg.chat.id;
    const apiSecretMessageId = apiSecretCtx.msg.message_id;
    if (apiSecret.startsWith('/')) {
      await ctx.api.deleteMessage(apiSecretChatId, apiSecretMessageId).catch(() => {});
      await ctx.reply('Wizard cancelled. Resend your command to start fresh.');
      return;
    }

    // Delete both secret-bearing messages. Use primitive ids + ctx.api so the
    // external callback doesn't depend on the waitFor context objects, which
    // have replay-time quirks when used with conversation.external.
    await conversation.external(async () => {
      for (const [chatId, messageId, label] of [
        [apiKeyChatId, apiKeyMessageId, 'API key'],
        [apiSecretChatId, apiSecretMessageId, 'API secret'],
      ] as const) {
        try {
          await ctx.api.deleteMessage(chatId, messageId);
        } catch (error) {
          logger.warn({err: error, label}, 'accountEdit: failed to delete secret message');
        }
      }
    });

    await ctx.reply('Validating credentials…');

    const result = await conversation.external(async () => {
      try {
        const client = getBrokerClient({exchangeId: account.exchange, apiKey, apiSecret, isPaper: account.isPaper});
        // 10s timeout guards against the underlying Alpaca HTTP client's
        // Infinity retry loop on network errors / 429s — without it a flaky
        // validation could hang the wizard forever.
        await Promise.race([
          client.getTime(),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Validation timed out after 10s')), 10_000)),
        ]);
        Account.update(account.id, {apiKey, apiSecret});
        return {ok: true as const};
      } catch (error) {
        // Log ONLY the message — the raw axios error carries the API key
        // and secret in its request.headers / config.headers fields.
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error({message}, 'accountEdit wizard failed');
        return {ok: false as const, error: message};
      }
    });

    if (result.ok) {
      await ctx.reply(`Account "${account.name}" (ID: ${account.id}) updated successfully. Connection test passed.`);
    } else {
      await ctx.reply(`Error updating account: ${result.error}`);
    }
  };
}
