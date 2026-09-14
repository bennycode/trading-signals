# @typedtrader/exchange-cli

Command-line interface for [@typedtrader/exchange](../exchange). It exposes the typed broker clients for [Alpaca](https://alpaca.markets/) and [Trading212](https://www.trading212.com/) from the terminal: results are JSON on stdout, streaming events are NDJSON, and errors go to stderr with exit code 1.

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
exchange-cli wait AAPL <orderId> --broker alpaca --timeout 5m
exchange-cli cancel AAPL <orderId> --broker alpaca
exchange-cli candles AAPL --broker alpaca --count 10 --interval 5m
exchange-cli watch-candles AAPL --broker alpaca --take 3
```

Set `<BROKER>_PAPER_API_KEY` and `<BROKER>_PAPER_API_SECRET` in the environment, for example `ALPACA_PAPER_API_KEY`. Paper trading is the default. `--live` selects `<BROKER>_LIVE_API_KEY` / `<BROKER>_LIVE_API_SECRET` and the live trading host. The CLI does not load environment files automatically or read `*_USE_PAPER`; Node's `--env-file` can load an existing file:

```sh
node --env-file=.env "$(which exchange-cli)" balances --broker alpaca
```

The command resolves the installed executable, so it works the same for a global and a local installation. From this package's source directory, use `npm run cli -- <command> ...` with exported credentials.

| Command | Description |
| --- | --- |
| `verify` | Check broker credentials. |
| `balances` | List cash balances and positions. |
| `instruments <query>` | Search equities by ticker, name, or ISIN. Reports the venue, and on Alpaca also whether the instrument is tradable and fractionable. |
| `quote <ticker>` | Show the latest candle close, not a bid/ask quote. |
| `rules <ticker>` | Show trading rules for a ticker. |
| `orders <ticker>` | List open orders for a ticker. |
| `fills <ticker>` | List order fills for a ticker. |
| `buy <ticker> <quantity>` | Place a market buy, or use `--limit <price>` for a limit order. |
| `sell <ticker> <quantity>` | Place a market sell, or use `--limit <price>` for a limit order. |
| `cancel <ticker> <orderId>` | Request cancellation of one order; use `--all` instead of the order ID to target all open orders for the ticker. |
| `wait <ticker> <orderId>` | Wait for a fill or for the order to close. |
| `candles <ticker>` | Fetch recent candles. |
| `watch-candles <ticker>` | Stream candles as NDJSON. |
| `watch-orders` | Stream order fills as NDJSON. |
| `time` | Show the broker client's time. |

An instrument carries what its broker publishes about it:

```sh
$ exchange-cli instruments msci --broker alpaca | jq -c '.[] | select(.ticker == "URTH" or .ticker == "IRRRF")'
{"currency":"USD","exchange":"OTC","fractionable":false,"name":"iShares III plc Core MSCI World UCITS ETF (Ireland)","ticker":"IRRRF","tradable":false}
{"currency":"USD","exchange":"ARCA","fractionable":true,"name":"iShares MSCI World ETF","ticker":"URTH","tradable":true}
```

Alpaca marks each asset as tradable or not, which separates a US-listed ETF from the foreign listings that share its name. Trading212 publishes neither flag, so those two fields are left out for it rather than guessed; its venue is resolved from the instrument's working schedule.

`--dry-run` checks quantity rules, the limit-price increment, and the minimum order value, then returns the broker's fee estimate without submitting an order; it does not guarantee acceptance. A `wait` timeout leaves the order open. Streaming runs until Ctrl-C unless `--take` is supplied.
