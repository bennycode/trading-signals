import {Agent} from '@xmtp/agent-sdk';
import {getTestUrl} from '@xmtp/agent-sdk/debug';
import {CommandRouter} from '@xmtp/agent-sdk/middleware';
import {isFromOwner} from './middleware/isFromOwner.js';
import {candle, time, uptime} from './command/index.js';

export async function startServer() {
  const router = new CommandRouter();

  router.command('/candle', async ctx => {
    const candleJson = await candle(ctx.message.content);
    if (candleJson) {
      await ctx.conversation.sendText(candleJson);
    }
  });

  router.command('/help', async ({conversation}) => {
    const commandCodeBlocks = router.commandList.map(cmd => `\`${cmd}\``);
    const answer = `I am supporting the following commands: ${commandCodeBlocks.join(', ')}`;
    await conversation.sendMarkdown(answer);
  });

  router.command('/time', async ({conversation}) => {
    await conversation.sendText(await time());
  });

  router.command('/uptime', async ({conversation}) => {
    await conversation.sendText(await uptime());
  });

  router.command('/myaddress', async ctx => {
    const yourAddress = await ctx.getSenderAddress();
    await ctx.conversation.sendText(`Your address is: ${yourAddress}`);
  });

  router.command('/youraddress', async ctx => {
    const myAddress = await ctx.getClientAddress();
    await ctx.conversation.sendText(`My address is: ${myAddress}`);
  });

  router.command('/version', async ({client, conversation}) => {
    const libXmtpVersion = client.libxmtpVersion;
    await conversation.sendText(`My libXMTP version is: ${libXmtpVersion}`);
  });

  const agent = await Agent.createFromEnv({
    appVersion: '@typedtrader/messaging',
  });

  agent.on('start', ctx => {
    console.log(`Message me: ${getTestUrl(ctx.client)}`);
  });

  if (process.env.XMTP_OWNER_ADDRESS) {
    agent.use(isFromOwner);
  }
  agent.use(router.middleware());
  await agent.start();
}
