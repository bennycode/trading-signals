# @typedtrader/messaging

Messaging interface for controlling personal trading bots remotely via [Telegram](https://core.telegram.org/bots) (using [grammY](https://grammy.dev/)).

## Features

- **Multi-Platform:** Flexible `MessagingPlatform` interface for adding new platforms
- **Command Interface:** Execute trading bot commands via messaging
- **Real-Time Updates:** Get live candle data, time, and bot status
- **Owner Authentication:** Access control via Telegram user IDs
- **Remote Control:** Manage your trading bot from anywhere securely

## Usage

This package starts a chatbot based on environment variables. Control your trading bot by sending slash commands directly in the chat.

### Telegram

Set `TELEGRAM_BOT_TOKEN` to enable. Message the bot from Telegram. Create a bot token via [@BotFather](https://t.me/BotFather).

### Brokers

`/accountAdd` offers Alpaca, Trading212 and Interactive Brokers. The first two are an API key and secret, which is all a chat message can carry. The other two are not:

- **Trading212** serves no candles, so it borrows them from an Alpaca account you added first, in the same paper or live mode.
- **Interactive Brokers** has no API keys at all. Its credential pair is the IBKR Pro username and password, which the broker uses to start the Client Portal Gateway and log in — so the **host running this bot needs that gateway**, along with Java and the optional `playwright` dependency. Adding the account launches it and waits for your second factor, which takes minutes rather than seconds on first use. There is no paper toggle: the gateway trades whichever account it logged into, so add a paper account by giving a paper username. Expect to re-approve the second factor roughly daily, and note that an account without a market-data subscription returns candles about 15 minutes delayed.

You must also set `TELEGRAM_OWNER_IDS` to a comma-separated list of Telegram user IDs (e.g. `TELEGRAM_OWNER_IDS=111111,222222`). The bot is **fail-closed**: if no owner IDs are configured, it refuses to start instead of accepting messages from anyone. Look up your numeric user ID via [@userinfobot](https://t.me/userinfobot).

### Commands

Command names are case-insensitive — `/reportAdd`, `/reportadd`, and `/REPORTADD` all work. The camelCase form is just for readability.

| Command           | Description                                              |
| ----------------- | -------------------------------------------------------- |
| `/help`           | List all available commands                              |
| `/accountAdd`     | Add a new trading account with exchange credentials      |
| `/accountEdit`    | Update an account's API key and secret                   |
| `/accountList`    | List all trading accounts                                |
| `/accountRemove`  | Remove a trading account                                 |
| `/accountTime`    | Show the current server time from an account's exchange  |
| `/candle`         | Fetch OHLC candle data for a trading pair                |
| `/myAddress`      | Show your address/ID on the current platform             |
| `/price`          | Get the latest closing price for a trading pair          |
| `/time`           | Display the current system time                          |
| `/uptime`         | Show how long the bot has been running                   |
| `/version`        | Display the platform SDK version                         |
| `/watchAdd`       | Create a price alert that monitors a pair at an interval |
| `/watchList`      | List all active price watches                            |
| `/watchRemove`    | Remove an active price watch                             |
| `/strategyAdd`    | Start a trading strategy on an account                   |
| `/strategyList`   | List all running strategies                              |
| `/strategyRemove` | Stop and remove a running strategy                       |
| `/reportAdd`      | Create a report (one-time or scheduled)                  |
| `/reportList`     | List all scheduled reports                               |
| `/reportRemove`   | Remove a scheduled report                                |
| `/yourAddress`    | Show the bot's address on the current platform           |

### Starting a Strategy

Use `/strategyAdd` to attach a trading strategy to an account. The format is:

```
/strategyAdd <strategyName> <accountId> <PAIR> [configJSON]
```

For example, to protect an existing AAPL position with a 5% stop-loss and 10% take-profit. The strategy named is the one that does nothing but guard a position it did not open — naming an entry strategy here would have it buy as well:

```
/strategyAdd @typedtrader/strategy-protected 1 AAPL,USD {"stopLossPct":"5","takeProfitPct":"10"}
```

## Motivation

The "@typedtrader/messaging" library provides a way to interact with your trading bots through messaging platforms. It's designed for traders who want to monitor and control their automated trading systems remotely without exposing public APIs.

## Security

The SQLite database of the messaging bot uses [SQLCipher](https://www.zetetic.net/sqlcipher/) encryption:

- Encryption key stored in `TYPEDTRADER_DB_ENCRYPTION_KEY` environment variable
- Protects data at rest (disk theft, backup leaks)

> [!CAUTION]
>
> Always verify that you're communicating with your bot. Keep your credentials secure and never share them. This system is designed for personal use and should not be exposed to untrusted users.
