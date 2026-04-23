import {
  accountAdd,
  accountList,
  accountRemove,
  accountTime,
  candle,
  health,
  price,
  reportAdd,
  reportList,
  reportRemove,
  strategyAdd,
  strategyConfig,
  strategyList,
  strategyRemove,
  strategyState,
  time,
  uptime,
  watchAdd,
  watchList,
  watchRemove,
} from './command/index.js';
import {initializeDatabase} from './database/initializeDatabase.js';
import {logger} from './logger.js';
import type {MessagingPlatform} from './platform/index.js';
import {TelegramPlatform} from './platform/TelegramPlatform.js';
import {WatchMonitor, StrategyMonitor, ReportScheduler} from './service/index.js';

interface Monitors {
  watchMonitor: WatchMonitor;
  strategyMonitor: StrategyMonitor;
  reportScheduler: ReportScheduler;
}

function registerCommands(platform: MessagingPlatform, monitors: Monitors): void {
  platform.registerCommand('help', async ctx => {
    const lines = platform.commandList.map((cmd, index) => `${index + 1}. ${cmd}`);
    const answer = `I am supporting the following commands:\n${lines.join('\n')}`;
    await ctx.reply(answer);
  });

  platform.registerCommand('accountAdd', async ctx => {
    const result = await accountAdd(ctx.content, ctx.senderId);

    if (result) {
      await ctx.reply(result);
    }
  });

  platform.registerCommand('accountList', async ctx => {
    await ctx.reply(await accountList(ctx.senderId));
  });

  platform.registerCommand('accountRemove', async ctx => {
    const result = await accountRemove(ctx.content, ctx.senderId);

    if (result) {
      await ctx.reply(result);
    }
  });

  platform.registerCommand('accountTime', async ctx => {
    const result = await accountTime(ctx.content, ctx.senderId);

    if (result) {
      await ctx.reply(result);
    }
  });

  platform.registerCommand('candle', async ctx => {
    const candleJson = await candle(ctx.content, ctx.senderId);

    if (candleJson) {
      await ctx.reply(candleJson);
    }
  });

  platform.registerCommand('price', async ctx => {
    await ctx.reply(await price(ctx.content, ctx.senderId));
  });

  platform.registerCommand('time', async ctx => {
    await ctx.reply(await time());
  });

  platform.registerCommand('health', async ctx => {
    await ctx.reply(await health());
  });

  platform.registerCommand('uptime', async ctx => {
    await ctx.reply(await uptime());
  });

  platform.registerCommand('watchAdd', async ctx => {
    const result = await watchAdd(ctx.content, ctx.senderId);
    await ctx.reply(result.message);

    if (result.watch) {
      try {
        await monitors.watchMonitor.subscribeToWatch(result.watch);
      } catch (error) {
        logger.error({err: error}, 'Error subscribing to new watch');
      }
    }
  });

  platform.registerCommand('watchList', async ctx => {
    await ctx.reply(await watchList(ctx.senderId));
  });

  platform.registerCommand('watchRemove', async ctx => {
    const result = await watchRemove(ctx.content, ctx.senderId);
    await ctx.reply(result.message);

    if (result.watchId) {
      monitors.watchMonitor.unsubscribeFromWatch(result.watchId);
    }
  });

  platform.registerCommand('strategyAdd', async ctx => {
    const result = await strategyAdd(ctx.content, ctx.senderId);
    await ctx.reply(result.message);

    if (result.strategy) {
      try {
        await monitors.strategyMonitor.subscribeToStrategy(result.strategy);
      } catch (error) {
        logger.error({err: error}, 'Error starting strategy');
      }
    }
  });

  platform.registerCommand('strategyList', async ctx => {
    await ctx.reply(await strategyList(ctx.senderId));
  });

  platform.registerCommand('strategyConfig', async ctx => {
    await ctx.reply(await strategyConfig(ctx.content, ctx.senderId));
  });

  platform.registerCommand('strategyState', async ctx => {
    await ctx.reply(await strategyState(ctx.content, ctx.senderId));
  });

  platform.registerCommand('strategyRemove', async ctx => {
    const result = await strategyRemove(ctx.content, ctx.senderId);
    await ctx.reply(result.message);

    if (result.strategyId) {
      try {
        await monitors.strategyMonitor.unsubscribeFromStrategy(result.strategyId);
      } catch (error) {
        logger.error({err: error}, 'Error stopping strategy');
      }
    }
  });

  platform.registerCommand('reportAdd', async ctx => {
    const result = await reportAdd(ctx.content, ctx.senderId);
    await ctx.reply(result.message);

    if (result.report?.intervalMs) {
      try {
        monitors.reportScheduler.scheduleReport(result.report, {runImmediately: true});
      } catch (error) {
        logger.error({err: error}, 'Error scheduling report');
      }
    }
  });

  platform.registerCommand('reportList', async ctx => {
    await ctx.reply(await reportList(ctx.senderId));
  });

  platform.registerCommand('reportRemove', async ctx => {
    const result = await reportRemove(ctx.content, ctx.senderId);
    await ctx.reply(result.message);

    if (result.reportId) {
      monitors.reportScheduler.unscheduleReport(result.reportId);
    }
  });

  platform.registerCommand('myAddress', async ctx => {
    await ctx.reply(`Your address is: ${ctx.senderId.split(':').slice(1).join(':')}`);
  });

  platform.registerCommand('yourAddress', async ctx => {
    await ctx.reply(`My address is: ${platform.platformInfo.botAddress}`);
  });

  platform.registerCommand('version', async ctx => {
    await ctx.reply(`My version is: ${platform.platformInfo.sdkVersion}`);
  });
}

export async function startServer() {
  await initializeDatabase();

  const platforms = new Map<string, MessagingPlatform>();

  if (process.env.TELEGRAM_BOT_TOKEN) {
    const telegramPlatform = new TelegramPlatform(process.env.TELEGRAM_BOT_TOKEN, process.env.TELEGRAM_OWNER_IDS);
    platforms.set('telegram', telegramPlatform);
  }

  if (platforms.size === 0) {
    logger.warn('No messaging platforms configured. Set TELEGRAM_BOT_TOKEN to enable a platform.');
  }

  const monitors: Monitors = {
    watchMonitor: new WatchMonitor(platforms),
    strategyMonitor: new StrategyMonitor(platforms),
    reportScheduler: new ReportScheduler(platforms),
  };

  for (const [, platform] of platforms) {
    registerCommands(platform, monitors);
    platform.setReportScheduler?.(monitors.reportScheduler);
    platform.setWatchMonitor?.(monitors.watchMonitor);
    platform.setStrategyMonitor?.(monitors.strategyMonitor);
  }

  // Start platforms first so the bot stays responsive for commands like
  // /strategyList even if a monitor's startup stalls (e.g. a stuck
  // exchange WebSocket during strategy subscription).
  for (const platform of platforms.values()) {
    await platform.start();
  }

  // Start monitors in the background — do not await, so that a hang in one
  // (e.g. an Alpaca "connection limit exceeded" retry loop) cannot block
  // the others or the command surface.
  monitors.watchMonitor.start().catch((error: unknown) => {
    logger.error({err: error}, 'Error starting watch monitor');
  });

  monitors.strategyMonitor.start().catch((error: unknown) => {
    logger.error({err: error}, 'Error starting strategy monitor');
  });

  monitors.reportScheduler.start().catch((error: unknown) => {
    logger.error({err: error}, 'Error starting report scheduler');
  });

  // Graceful shutdown
  const shutdown = async () => {
    try {
      monitors.watchMonitor.stop();
      await monitors.strategyMonitor.stop();
      monitors.reportScheduler.stop();

      for (const platform of platforms.values()) {
        await platform.stop();
      }
    } catch (error) {
      logger.error({err: error}, 'Error during shutdown');
    } finally {
      logger.flush();
      process.exit(0);
    }
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
