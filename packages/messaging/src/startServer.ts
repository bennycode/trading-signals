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
  strategyList,
  strategyRemove,
  time,
  uptime,
  watchAdd,
  watchList,
  watchRemove,
} from './command/index.js';
import {initializeDatabase} from './database/initializeDatabase.js';
import type {CommandHandler, MessagingPlatform} from './platform/index.js';
import {TelegramPlatform} from './platform/TelegramPlatform.js';
import {WatchMonitor, StrategyMonitor, ReportScheduler} from './service/index.js';

interface Monitors {
  watchMonitor: WatchMonitor;
  strategyMonitor: StrategyMonitor;
  reportScheduler: ReportScheduler;
}

function registerCommands(platform: MessagingPlatform, monitors: Monitors): void {
  platform.registerCommand('help', async ctx => {
    const commandCodeBlocks = platform.commandList.map(cmd => `\`${cmd}\``);
    const answer = `I am supporting the following commands: ${commandCodeBlocks.join(', ')}`;
    await ctx.reply(answer);
  });

  platform.registerCommand('accountadd', async ctx => {
    const result = await accountAdd(ctx.content, ctx.senderId);

    if (result) {
      await ctx.reply(result);
    }
  });

  platform.registerCommand('accountlist', async ctx => {
    await ctx.reply(await accountList(ctx.senderId));
  });

  platform.registerCommand('accountremove', async ctx => {
    const result = await accountRemove(ctx.content, ctx.senderId);

    if (result) {
      await ctx.reply(result);
    }
  });

  platform.registerCommand('accounttime', async ctx => {
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

  platform.registerCommand('watchadd', async ctx => {
    const result = await watchAdd(ctx.content, ctx.senderId);
    await ctx.reply(result.message);

    if (result.watch) {
      try {
        await monitors.watchMonitor.subscribeToWatch(result.watch);
      } catch (error) {
        console.error(`Error subscribing to new watch: ${error}`);
      }
    }
  });

  platform.registerCommand('watchlist', async ctx => {
    await ctx.reply(await watchList(ctx.senderId));
  });

  platform.registerCommand('watchremove', async ctx => {
    const result = await watchRemove(ctx.content, ctx.senderId);
    await ctx.reply(result.message);

    if (result.watchId) {
      monitors.watchMonitor.unsubscribeFromWatch(result.watchId);
    }
  });

  platform.registerCommand('strategyadd', async ctx => {
    const result = await strategyAdd(ctx.content, ctx.senderId);
    await ctx.reply(result.message);

    if (result.strategy) {
      try {
        await monitors.strategyMonitor.subscribeToStrategy(result.strategy);
      } catch (error) {
        console.error(`Error starting strategy: ${error}`);
      }
    }
  });

  platform.registerCommand('strategylist', async ctx => {
    await ctx.reply(await strategyList(ctx.senderId));
  });

  platform.registerCommand('strategyremove', async ctx => {
    const result = await strategyRemove(ctx.content, ctx.senderId);
    await ctx.reply(result.message);

    if (result.strategyId) {
      try {
        await monitors.strategyMonitor.unsubscribeFromStrategy(result.strategyId);
      } catch (error) {
        console.error(`Error stopping strategy: ${error}`);
      }
    }
  });

  platform.registerCommand('reportadd', async ctx => {
    const result = await reportAdd(ctx.content, ctx.senderId);
    await ctx.reply(result.message);

    if (result.report?.intervalMs) {
      try {
        monitors.reportScheduler.scheduleReport(result.report);
      } catch (error) {
        console.error(`Error scheduling report: ${error}`);
      }
    }
  });

  platform.registerCommand('reportlist', async ctx => {
    await ctx.reply(await reportList(ctx.senderId));
  });

  platform.registerCommand('reportremove', async ctx => {
    const result = await reportRemove(ctx.content, ctx.senderId);
    await ctx.reply(result.message);

    if (result.reportId) {
      monitors.reportScheduler.unscheduleReport(result.reportId);
    }
  });

  // Trade commands run as interactive wizards on Telegram (account picker +
  // Yes/No confirmation). The fallback handler below only runs on platforms
  // that don't install a wizard override — currently none do.
  const tradeFallback: CommandHandler = async ctx => {
    await ctx.reply('Trade commands are only supported on Telegram right now.');
  };
  platform.registerCommand('buymarket', tradeFallback);
  platform.registerCommand('sellmarket', tradeFallback);
  platform.registerCommand('buylimit', tradeFallback);
  platform.registerCommand('selllimit', tradeFallback);

  platform.registerCommand('myaddress', async ctx => {
    await ctx.reply(`Your address is: ${ctx.senderId.split(':').slice(1).join(':')}`);
  });

  platform.registerCommand('youraddress', async ctx => {
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
    console.warn('Warning: No messaging platforms configured. Set TELEGRAM_BOT_TOKEN to enable a platform.');
  }

  const monitors: Monitors = {
    watchMonitor: new WatchMonitor(platforms),
    strategyMonitor: new StrategyMonitor(platforms),
    reportScheduler: new ReportScheduler(platforms),
  };

  for (const [, platform] of platforms) {
    registerCommands(platform, monitors);
    platform.setReportScheduler?.(monitors.reportScheduler);
  }

  // Start monitors
  try {
    await monitors.watchMonitor.start();
  } catch (error) {
    console.error('Error starting watch monitor:', error);
  }

  try {
    await monitors.strategyMonitor.start();
  } catch (error) {
    console.error('Error starting strategy monitor:', error);
  }

  try {
    await monitors.reportScheduler.start();
  } catch (error) {
    console.error('Error starting report scheduler:', error);
  }

  // Start all platforms
  for (const platform of platforms.values()) {
    await platform.start();
  }

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
      console.error('Error during shutdown:', error);
    } finally {
      process.exit(0);
    }
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
