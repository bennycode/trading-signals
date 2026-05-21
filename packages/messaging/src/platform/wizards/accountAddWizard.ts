import {AlpacaBroker, Trading212Broker, getAuthenticatedBrokerClient} from '@typedtrader/exchange';
import {buildMarketDataFromAccount} from '../../broker/getAccountBrokerClient.js';
import {Account} from '../../database/models/Account.js';
import {logger} from '../../logger.js';
import {deleteSecretMessages, inlineKeyboard, waitForTextOrCancel, type InlineButton, type WizardContext, type WizardConversation} from './shared.js';

/**
 * Brokers that bring no market-data feed of their own and therefore must reuse another
 * account's credentials for candles. Currently only Trading212.
 */
const EXCHANGES_WITHOUT_MARKET_DATA: readonly string[] = [Trading212Broker.NAME];

export interface AccountAddWizardArgs {
  userId: string;
}

const EXCHANGES = [AlpacaBroker.NAME, Trading212Broker.NAME] as const;

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
      `Broker: ${exchange}\nChoose account mode:`,
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

    // Brokers without their own market-data feed (e.g. Trading212) reuse another account's
    // credentials for candles. Ask which existing account should serve as that data source.
    let marketDataAccountId: number | null = null;
    if (EXCHANGES_WITHOUT_MARKET_DATA.includes(exchange)) {
      // The data source must run in the same mode: Alpaca serves data from different
      // environments (data.sandbox vs data.alpaca) and keys for paper vs live, so a paper
      // account can only feed a paper account and likewise for live.
      const modeLabel = isPaper ? 'Paper' : 'Live';
      const dataSourceAccounts = await conversation.external(() =>
        Account.findByUserId(args.userId).filter(
          candidate => candidate.exchange === AlpacaBroker.NAME && candidate.isPaper === isPaper
        )
      );

      if (dataSourceAccounts.length === 0) {
        await modeCb.editMessageText(
          `${exchange} has no market data of its own and needs an existing ${modeLabel} ${AlpacaBroker.NAME} account as its data source.\n\nAdd a ${modeLabel} ${AlpacaBroker.NAME} account first, then re-run /accountAdd.`
        );
        return;
      }

      const dataSourceButtons: InlineButton[][] = dataSourceAccounts.map(candidate => [
        {
          text: `${candidate.name} (${candidate.isPaper ? 'Paper' : 'Live'})`,
          callback_data: `accountadd:mds:${candidate.id}`,
        },
      ]);
      await modeCb.editMessageText(
        `Broker: ${exchange}\nMode: ${isPaper ? 'Paper' : 'Live'}\n\nPick the account to use for market data:`,
        inlineKeyboard(dataSourceButtons)
      );

      const dataSourceCb = await conversation.waitForCallbackQuery(
        dataSourceAccounts.map(candidate => `accountadd:mds:${candidate.id}`)
      );
      await dataSourceCb.answerCallbackQuery();
      marketDataAccountId =
        typeof dataSourceCb.match === 'string' ? Number(dataSourceCb.match.split(':')[2]) : dataSourceAccounts[0].id;

      await dataSourceCb.editMessageText(
        `Broker: ${exchange}\nMode: ${isPaper ? 'Paper' : 'Live'}\n\nSend a name for this account:`
      );
    } else {
      await modeCb.editMessageText(
        `Broker: ${exchange}\nMode: ${isPaper ? 'Paper' : 'Live'}\n\nSend a name for this account:`
      );
    }

    const nameResp = await waitForTextOrCancel(conversation, ctx);
    if (nameResp.cancelled) return;
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
      {chatId: apiKeyChatId, messageId: apiKeyMessageId, label: 'API key'},
      {chatId: apiSecretChatId, messageId: apiSecretMessageId, label: 'API secret'},
    ]);

    await ctx.reply('Validating credentials…');

    const result = await conversation.external(async () => {
      try {
        // Feed-less brokers need their referenced data source wired in, otherwise the
        // connection test (and every later candle call) fails to construct a client.
        let marketData;
        if (marketDataAccountId !== null) {
          const source = Account.findByUserIdAndId(args.userId, marketDataAccountId);
          if (!source) {
            return {ok: false as const, error: 'Selected market-data account was not found.'};
          }
          marketData = buildMarketDataFromAccount(source);
        }

        await getAuthenticatedBrokerClient(
          {exchangeId: exchange, apiKey, apiSecret, isPaper},
          marketData ? {marketData} : undefined
        );
        const account = Account.create({
          userId: args.userId,
          name,
          exchange,
          isPaper,
          apiKey,
          apiSecret,
          marketDataAccountId,
        });
        return {ok: true as const, id: account.id};
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error({err: error}, 'accountAdd wizard failed');
        return {ok: false as const, error: message};
      }
    });

    if (result.ok) {
      await ctx.reply(`Account created (ID: ${result.id}). Connection test passed.`);
    } else {
      await ctx.reply(`Error creating account: ${result.error}`);
    }
  };
}
