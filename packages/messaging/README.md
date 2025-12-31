# @typedtrader/messaging

End-to-end encrypted messaging interface for controlling personal trading bots remotely via the [XMTP protocol](https://xmtp.org/). Enables secure command execution and real-time trading bot interaction.

## Features

- **End-to-End Encryption:** Secure communication using XMTP protocol
- **Command Interface:** Execute trading bot commands via messaging
- **Real-Time Updates:** Get live candle data, time, and bot status
- **Owner Authentication:** Built-in middleware to verify message sender
- **Remote Control:** Manage your trading bot from anywhere securely

## Motivation

The "@typedtrader/messaging" library provides a secure way to interact with your trading bots through encrypted messaging. It's designed for traders who want to monitor and control their automated trading systems remotely without exposing public APIs.

Traditional web dashboards need public websites, databases, and login systems - all targets for hackers. This messaging approach is different: messages are encrypted end-to-end, there's no public endpoint to attack, and only your wallet can decrypt the commands.

> [!CAUTION]
>
> Always verify that you're communicating with your bot through the correct wallet address. Keep your wallet keys secure and never share them. This system is designed for personal use and should not be exposed to untrusted users.
