import {AlpacaExchange, getExchangeClient} from '@typedtrader/exchange';
import {Account} from '../../database/models/Account.js';
import {logger} from '../../logger.js';
import {inlineKeyboard, type InlineButton, type WizardContext, type WizardConversation} from './shared.js';

export interface AccountAddWizardArgs {
  userId: string;
}

const EXCHANGES = [AlpacaExchange.NAME] as const;

export function makeAccountAddWizard() {
  return async function accountAddWizard(
    conversation: WizardConversation,
    ctx: WizardContext,
    args: AccountAddWizardArgs
  ): Promise<void> {
    const exchangeButtons: InlineButton[][] = EXCHANGES.map(name => [
      {text: name, callback_data: `accountadd:ex:${name}`},
    ]);
    await ctx.reply('Pick an exchange:', inlineKeyboard(exchangeButtons));

    const exchangeCb = await conversation.waitForCallbackQuery(EXCHANGES.map(n => `accountadd:ex:${n}`));
    await exchangeCb.answerCallbackQuery();
    const exchange = typeof exchangeCb.match === 'string' ? exchangeCb.match.split(':')[2] : EXCHANGES[0];

    await exchangeCb.editMessageText(
      `Exchange: ${exchange}\nChoose account mode:`,
      inlineKeyboard([
        [
          {text: '📝 Paper', callback_data: 'accountadd:mode:paper'},
          {text: '💵 Live', callback_data: 'accountadd:mode:live'},
        ],
      ])
    );

    const modeCb = await conversation.waitForCallbackQuery(['accountadd:mode:paper', 'accountadd:mode:live']);
    await modeCb.answerCallbackQuery();
    const isPaper = modeCb.match === 'accountadd:mode:paper';

    await modeCb.editMessageText(`Exchange: ${exchange}\nMode: ${isPaper ? 'Paper' : 'Live'}\n\nSend a name for this account:`);
    const nameCtx = await conversation.waitFor('message:text');
    const name = nameCtx.msg.text.trim();
    if (!name) {
      await ctx.reply('Account name cannot be empty. Aborted.');
      return;
    }

    await ctx.reply('Send the API key (the message will be deleted after receipt):');
    const apiKeyCtx = await conversation.waitFor('message:text');
    const apiKey = apiKeyCtx.msg.text.trim();
    const apiKeyChatId = apiKeyCtx.msg.chat.id;
    const apiKeyMessageId = apiKeyCtx.msg.message_id;

    await ctx.reply('Send the API secret (the message will be deleted after receipt):');
    const apiSecretCtx = await conversation.waitFor('message:text');
    const apiSecret = apiSecretCtx.msg.text.trim();
    const apiSecretChatId = apiSecretCtx.msg.chat.id;
    const apiSecretMessageId = apiSecretCtx.msg.message_id;

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
          logger.warn({err: error, label}, 'accountAdd: failed to delete secret message');
        }
      }
    });

    await ctx.reply('Validating credentials…');

    const result = await conversation.external(async () => {
      try {
        const client = getExchangeClient({exchangeId: exchange, apiKey, apiSecret, isPaper});
        // 10s timeout guards against the underlying Alpaca HTTP client's
        // Infinity retry loop on network errors / 429s — without it a flaky
        // validation could hang the wizard forever.
        await Promise.race([
          client.getTime(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Validation timed out after 10s')), 10_000)
          ),
        ]);
        const account = Account.create({
          userId: args.userId,
          name,
          exchange,
          isPaper,
          apiKey,
          apiSecret,
        });
        return {ok: true as const, id: account.id};
      } catch (error) {
        logger.error({err: error}, 'accountAdd wizard failed');
        return {ok: false as const, error: error instanceof Error ? error.message : 'Unknown error'};
      }
    });

    if (result.ok) {
      await ctx.reply(`Account created (ID: ${result.id}). Connection test passed.`);
    } else {
      await ctx.reply(`Error creating account: ${result.error}`);
    }
  };
}
