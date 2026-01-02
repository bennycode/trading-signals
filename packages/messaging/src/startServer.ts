import {Agent} from '@xmtp/agent-sdk';
import {getTestUrl} from '@xmtp/agent-sdk/debug';
import {CommandRouter} from '@xmtp/agent-sdk/middleware';
import {isFromOwner} from './middleware/isFromOwner.js';
import {candle, time, uptime} from './command/index.js';

export async function startServer() {
  const router = new CommandRouter();

  router.command('/candle', async ctx => {
    await ctx.conversation.send(await candle(ctx.message.content));
  });

  router.command('/time', async ctx => {
    await ctx.conversation.send(await time());
  });

  router.command('/uptime', async ctx => {
    await ctx.conversation.send(await uptime());
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
