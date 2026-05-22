import {AlpacaBroker, getAuthenticatedBrokerClient} from '@typedtrader/exchange';
import {Account} from '../../database/models/Account.js';
import {logger} from '../../logger.js';
import {
  deleteSecretMessages,
  inlineKeyboard,
  waitForTextOrCancel,
  type InlineButton,
  type WizardContext,
  type WizardConversation,
} from './shared.js';

export interface AccountAddWizardArgs {
  userId: string;
}

const EXCHANGES = [AlpacaBroker.NAME] as const;

export function makeAccountAddWizard() {
  return async function accountAddWizard(
    conversation: WizardConversation,
    ctx: WizardContext,
    args: AccountAddWizardArgs
  ): Promise<void> {
    const exchangeButtons: InlineButton[][] = EXCHANGES.map(name => [
      {callback_data: `accountadd:ex:${name}`, text: name},
    ]);
    await ctx.reply('Pick an exchange:', inlineKeyboard(exchangeButtons));

    const exchangeCb = await conversation.waitForCallbackQuery(EXCHANGES.map(n => `accountadd:ex:${n}`));
    await exchangeCb.answerCallbackQuery();
    const exchange = typeof exchangeCb.match === 'string' ? exchangeCb.match.split(':')[2] : EXCHANGES[0];

    await exchangeCb.editMessageText(
      `Broker: ${exchange}\nChoose account mode:`,
      inlineKeyboard([
        [
          {callback_data: 'accountadd:mode:paper', text: '📝 Paper'},
          {callback_data: 'accountadd:mode:live', text: '💵 Live'},
        ],
      ])
    );

    const modeCb = await conversation.waitForCallbackQuery(['accountadd:mode:paper', 'accountadd:mode:live']);
    await modeCb.answerCallbackQuery();
    const isPaper = modeCb.match === 'accountadd:mode:paper';

    await modeCb.editMessageText(
      `Broker: ${exchange}\nMode: ${isPaper ? 'Paper' : 'Live'}\n\nSend a name for this account:`
    );
    const nameResp = await waitForTextOrCancel(conversation, ctx);
    if (nameResp.cancelled) {
      return;
    }
    const name = nameResp.text;
    if (!name) {
      await ctx.reply('Account name cannot be empty. Aborted.');
      return;
    }

    await ctx.reply('Send the API key (the message will be deleted after receipt):');
    const apiKeyCtx = await conversation.waitFor('message:text');
    const apiKey = apiKeyCtx.msg.text.trim();
    const apiKeyChatId = apiKeyCtx.msg.chat.id;
    const apiKeyMessageId = apiKeyCtx.msg.message_id;
    if (apiKey.startsWith('/')) {
      await ctx.api.deleteMessage(apiKeyChatId, apiKeyMessageId).catch(() => {});
      await ctx.reply('Wizard cancelled. Resend your command to start fresh.');
      return;
    }

    await ctx.reply('Send the API secret (the message will be deleted after receipt):');
    const apiSecretCtx = await conversation.waitFor('message:text');
    const apiSecret = apiSecretCtx.msg.text.trim();
    const apiSecretChatId = apiSecretCtx.msg.chat.id;
    const apiSecretMessageId = apiSecretCtx.msg.message_id;
    if (apiSecret.startsWith('/')) {
      await ctx.api.deleteMessage(apiKeyChatId, apiKeyMessageId).catch(() => {});
      await ctx.api.deleteMessage(apiSecretChatId, apiSecretMessageId).catch(() => {});
      await ctx.reply('Wizard cancelled. Resend your command to start fresh.');
      return;
    }

    await deleteSecretMessages(conversation, ctx, 'accountAdd', [
      {chatId: apiKeyChatId, label: 'API key', messageId: apiKeyMessageId},
      {chatId: apiSecretChatId, label: 'API secret', messageId: apiSecretMessageId},
    ]);

    await ctx.reply('Validating credentials…');

    const result = await conversation.external(async () => {
      try {
        await getAuthenticatedBrokerClient({apiKey, apiSecret, exchangeId: exchange, isPaper});
        const account = Account.create({
          apiKey,
          apiSecret,
          exchange,
          isPaper,
          name,
          userId: args.userId,
        });
        return {id: account.id, ok: true as const};
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error({err: error}, 'accountAdd wizard failed');
        return {error: message, ok: false as const};
      }
    });

    if (result.ok) {
      await ctx.reply(`Account created (ID: ${result.id}). Connection test passed.`);
    } else {
      await ctx.reply(`Error creating account: ${result.error}`);
    }
  };
}
