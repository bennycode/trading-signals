# @typedtrader/messaging

Messaging interface for controlling personal trading bots remotely via [XMTP](https://xmtp.org/) and [Telegram](https://core.telegram.org/bots) (using [Telegraf](https://telegraf.js.org/)). Both platforms can run simultaneously in a single process.

## Features

- **Multi-Platform:** Supports XMTP (end-to-end encrypted) and Telegram bots
- **Command Interface:** Execute trading bot commands via messaging
- **Real-Time Updates:** Get live candle data, time, and bot status
- **Owner Authentication:** Per-platform access control (wallet addresses for XMTP, user IDs for Telegram)
- **Remote Control:** Manage your trading bot from anywhere securely

## Usage

This package starts a chatbot on one or both platforms based on environment variables. Control your trading bot by sending slash commands directly in the chat.

### XMTP

Set `XMTP_ENV` to enable. Message the bot from any XMTP-compatible wallet.

### Telegram

Set `TELEGRAM_BOT_TOKEN` to enable. Message the bot from Telegram. Create a bot token via [@BotFather](https://t.me/BotFather).

### Commands

| Command          | Description                                              |
| ---------------- | -------------------------------------------------------- |
| `/help`          | List all available commands                              |
| `/accountAdd`    | Add a new trading account with exchange credentials      |
| `/accountList`   | List all trading accounts                                |
| `/accountRemove` | Remove a trading account                                 |
| `/accountTime`   | Show the current server time from an account's exchange  |
| `/candle`        | Fetch OHLC candle data for a trading pair                |
| `/myaddress`     | Show your address/ID on the current platform             |
| `/price`         | Get the latest closing price for a trading pair          |
| `/time`          | Display the current system time                          |
| `/uptime`        | Show how long the bot has been running                   |
| `/version`       | Display the platform SDK version                         |
| `/watchAdd`      | Create a price alert that monitors a pair at an interval |
| `/watchList`     | List all active price watches                            |
| `/watchRemove`   | Remove an active price watch                             |
| `/youraddress`   | Show the bot's address on the current platform           |

## Motivation

The "@typedtrader/messaging" library provides a way to interact with your trading bots through messaging platforms. It's designed for traders who want to monitor and control their automated trading systems remotely without exposing public APIs.

With XMTP, messages are encrypted end-to-end — there's no public endpoint to attack and only your wallet can decrypt the commands. With Telegram, you get a familiar chat interface with user ID-based access control.

## Security

The SQLite database of the messaging bot uses [SQLCipher](https://www.zetetic.net/sqlcipher/) encryption:

- Encryption key stored in `TYPEDTRADER_DB_ENCRYPTION_KEY` environment variable
- Protects data at rest (disk theft, backup leaks)

> [!CAUTION]
>
> Always verify that you're communicating with your bot through the correct wallet address. Keep your wallet keys secure and never share them. This system is designed for personal use and should not be exposed to untrusted users.
