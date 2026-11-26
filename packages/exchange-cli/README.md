# @typedtrader/exchange-cli

Command-line interface for [@typedtrader/exchange](../exchange). It exposes the typed broker clients for [Alpaca](https://alpaca.markets/), [Trading212](https://www.trading212.com/) and [Interactive Brokers](https://www.interactivebrokers.com/) from the terminal: results are JSON on stdout, streaming events are NDJSON, and errors go to stderr with exit code 1.

## Installation

```sh
npm install -g @typedtrader/exchange-cli
```

The package is ESM-only and targets the latest Node.js LTS.

## Usage

Commander generates help from the command definitions. Use `exchange-cli --help` for an overview or `exchange-cli buy --help` (also `exchange-cli help buy`) for a command's arguments and options. Help requires no credentials. Put command-specific options after the command; global options such as `--broker` and `--live` work before or after it.

```sh
exchange-cli help
exchange-cli balances --broker trading212
exchange-cli instruments rolls --broker trading212
exchange-cli orders RRl_EQ --broker trading212 --counter GBX
exchange-cli buy AAPL 1 --broker alpaca --limit 100 --dry-run
exchange-cli buy AAPL 1 --broker alpaca --limit 100
exchange-cli buy AAPL 1 --broker alpaca --stop-atr
exchange-cli buy AAPL 1 --broker alpaca --stop-atr 2.5
exchange-cli wait AAPL <orderId> --broker alpaca --timeout 5m
exchange-cli cancel AAPL <orderId> --broker alpaca
exchange-cli candles AAPL --broker alpaca --count 10 --interval 5m
exchange-cli health NVDA --broker alpaca --table
exchange-cli health NVDA --broker alpaca --benchmark QQQ --table
exchange-cli health NVDA --broker alpaca --date 2026-10-15 --table
exchange-cli watch-candles AAPL --broker alpaca --take 3
exchange-cli balances --broker ibkr --live
exchange-cli instruments ANT --broker ibkr --live
```

Set `<BROKER>_PAPER_API_KEY` and `<BROKER>_PAPER_API_SECRET` in the environment, for example `ALPACA_PAPER_API_KEY`. Paper trading is the default. `--live` selects `<BROKER>_LIVE_API_KEY` / `<BROKER>_LIVE_API_SECRET` and the live trading host. The CLI does not load environment files automatically or read `*_USE_PAPER`; Node's `--env-file` can load an existing file:

```sh
node --env-file=.env "$(which exchange-cli)" balances --broker alpaca
```

The command resolves the installed executable, so it works the same for a global and a local installation. From this package's source directory, use `npm run cli -- <command> ...` with exported credentials.

### Trading212

Trading212 publishes no historical bars and no public stream, so `candles`, `watch-candles` and `quote` borrow Alpaca's feed: set `ALPACA_PAPER_API_KEY` / `ALPACA_PAPER_API_SECRET` (or the `ALPACA_LIVE_*` pair with `--live`) alongside the Trading212 credentials. Account and order commands need no Alpaca keys, and the candle commands say so when they are missing.

Its tickers carry a country and type suffix (`AAPL_US_EQ`), which is translated to the plain symbol before reaching Alpaca. Pass the Trading212 ticker and a `--counter` currency, since the suffix does not name one.

### Interactive Brokers

IBKR is the exception to everything above. It has no API keys, so its credential pair is a username and password: `IBKR_PAPER_USERNAME` / `IBKR_PAPER_PASSWORD`, or the `IBKR_LIVE_*` pair with `--live`. A single-environment setup can use the unprefixed `IBKR_USERNAME` / `IBKR_PASSWORD` for either. Both may be omitted when a gateway is already logged in.

It is the **username**, not the `DU…` account number that Client Portal shows beside it — the account number is not a login and the gateway will reject it.

Orders go through the [Client Portal Gateway](../exchange/src/broker/ibkr/README.md), a local Java process that must be running and logged in before any command, which `npm run gateway:ibkr` in the exchange package starts. A live login needs an IB Key push approved on your phone, so it cannot run unattended; a paper login has no second factor.

Paper trading is a separate login rather than a separate endpoint: IBKR issues the paper account its own username and account number, and the gateway's login page has a Live/Paper switch that must match — a paper username submitted in live mode is refused. So the gateway has to be logged in as the paper user, which `npm run gateway:ibkr:paper` does, and the CLI refuses the command when the session turns out to be on the other side of what `--live` asked for. Market data comes from IBKR itself, and is delayed by about 15 minutes without a market-data subscription.

| Command | Description |
| --- | --- |
| `verify` | Check broker credentials. |
| `balances` | List cash balances and positions. |
| `instruments <query>` | Search equities by ticker, name, or ISIN. Reports the venue and whether the instrument trades outside exchange hours, and on Alpaca also whether it is tradable and fractionable. IBKR searches its contract database server-side and reports no currency. |
| `quote <ticker>` | Show the latest candle close, not a bid/ask quote. |
| `rules <ticker>` | Show trading rules for a ticker. |
| `orders <ticker>` | List open orders for a ticker. |
| `fills <ticker>` | List order fills for a ticker. |
| `buy <ticker> <quantity>` | Place a market buy, or use `--limit <price>` for a limit order. With `--stop-atr` it waits for the fill and places a protective stop 3 average ranges below the price paid; `--stop-atr <multiple>` picks a different multiple. Without the flag no stop is placed. |
| `sell <ticker> <quantity>` | Place a market sell, or use `--limit <price>` for a limit order. |
| `cancel <ticker> <orderId>` | Request cancellation of one order; use `--all` instead of the order ID to target all open orders for the ticker. |
| `wait <ticker> <orderId>` | Wait for a fill or for the order to close. |
| `candles <ticker>` | Fetch recent candles. |
| `health <ticker>` | Score chart health on daily bars, from 100 (nothing against it) down to 0, reading eight checks across trend, momentum, volume, volatility and relative strength. `--benchmark <ticker>` replaces the index the relative strength check reads against (SPY by default), `--table` prints the card for a reader instead of JSON, `--date <YYYY-MM-DD>` reads the card as of that day instead of the newest bar, so every period counts back from it, and `--count <n>` sets the candles requested for the warm-up (120 by default, against a warm-up of 69 daily bars). |
| `watch-candles <ticker>` | Stream candles as NDJSON. |
| `watch-orders` | Stream order fills as NDJSON. |
| `time` | Show the broker client's time. |
| `smoke <ticker>` | Run every read-only call against one instrument and report each separately. Places no orders, so it is safe against a live account; exits non-zero if any call failed. |

An instrument carries what its broker publishes about it:

```sh
$ exchange-cli instruments msci --broker alpaca | jq -c '.[] | select(.ticker == "URTH" or .ticker == "IRRRF")'
{"currency":"USD","exchange":"OTC","fractionable":false,"name":"iShares III plc Core MSCI World UCITS ETF (Ireland)","ticker":"IRRRF","tradable":false}
{"currency":"USD","exchange":"ARCA","fractionable":true,"name":"iShares MSCI World ETF","ticker":"URTH","tradable":true}
```

Alpaca marks each asset as tradable or not, which separates a US-listed ETF from the foreign listings that share its name. Trading212 publishes neither flag, so those two fields are left out for it rather than guessed; its venue is resolved from the instrument's working schedule.

`extendedHours` says whether the instrument trades outside its exchange's hours, on the 24/5 venue each broker runs for that purpose. Both publish it, under different names, so both report it:

```sh
$ exchange-cli instruments apple --broker trading212 | jq -c '.[] | select(.ticker == "AAPL_US_EQ")'
{"currency":"USD","exchange":"NASDAQ","extendedHours":true,"isin":"US0378331005","name":"Apple","ticker":"AAPL_US_EQ"}
```

`--dry-run` checks quantity rules, the limit-price increment, and the minimum order value, then returns the broker's fee estimate without submitting an order; it does not guarantee acceptance. A `wait` timeout leaves the order open. Streaming runs until Ctrl-C unless `--take` is supplied.
