# trading-signals-cli

Command-line interface for [trading-signals](../trading-signals). It runs any of the library's technical indicators over candles or prices and prints the result as JSON, so an indicator can be checked against real data without writing a script.

## Installation

```sh
npm install -g trading-signals-cli
```

The package is ESM-only and targets the latest Node.js LTS. It is a separate package so that [trading-signals](../trading-signals) itself stays dependency-free.

## Usage

```sh
echo '[1, 2, 3, 4, 5]' | trading-signals-cli sma 3
trading-signals-cli rsi 14 --input candles.json
trading-signals-cli list stoch
```

Input arrives on stdin or through `--input <file>`, as a JSON array, newline-delimited JSON, or whitespace-separated numbers. Candle objects need a `close`; `high`, `low`, `open`, and `volume` are read when present. Prices may be strings, which is how brokers report them, so broker output pipes in directly:

```sh
exchange-cli candles AAPL --broker alpaca --count 50 | trading-signals-cli macd EMA:12 EMA:26 EMA:9
```

| Option            | Description                                                                                     |
| ----------------- | ----------------------------------------------------------------------------------------------- |
| `--input <file>`  | Read the input from a file instead of stdin.                                                    |
| `--price <field>` | Price that feeds price-based indicators: `close` (default), `high`, `low`, `open`, or `volume`. |
| `--all`           | Print every intermediate result as NDJSON instead of the last one.                              |

### Indicator arguments

Indicators are discovered from the library's own exports, so every indicator it ships is available here and `list` always matches the installed version. Arguments are passed through as the indicator's constructor expects them:

```sh
trading-signals-cli sma 20                                  # an interval
trading-signals-cli ao 5 34                                 # several intervals
trading-signals-cli ichimokucloud '{"conversionInterval":9}' # a config object
trading-signals-cli atr 14 SMA                              # an indicator class
trading-signals-cli macd EMA:12 EMA:26 EMA:9                # indicator instances
```

An argument is read as JSON, unless it names an indicator: a bare name (`SMA`) passes that class, and `NAME:ARGS` (`EMA:12`) passes an instance of it. Indicator names are matched without case, so `bollingerbands` and `BollingerBands` both work.

An indicator that takes its settings in one config object has to be given JSON. A number would be accepted by JavaScript and then ignored — `supertrend 14` would run with the default interval of 10 — so the CLI rejects it and names the settings it expects:

```sh
$ trading-signals-cli supertrend 14
SuperTrend takes its settings in a config object, so "14" would leave those defaults in place. Pass JSON instead, for example {"interval":…, "multiplier":…}.
```

The same holds for a setting that arrives in a later position, such as the thresholds an oscillator reads its signal from: `cci 20 1` is rejected rather than run with the default band. An argument beyond the ones a constructor declares (`sma 5 999`), a key it does not read (`supertrend '{"intervall":14}'`), and a misspelling nested inside a config (`rmi '{"signalThresholds":{"overbougt":80}}'`) are refused for the same reason — each would otherwise be dropped without a word and the reading would come from settings you did not ask for.

### Output

```sh
$ trading-signals-cli rsi 14 --input candles.json
{"indicator":"RSI","input":"close","inputs":1235,"required":15,"result":39.15918894698538,"stable":true,"signal":{"hasChanged":false,"state":"SIDEWAYS"}}
```

`input` reports whether the indicator read whole candles or a single price per bar; which of the two it takes is decided by the fields it actually reads, not by the shape of the input. `required` is the number of inputs it needs before it emits anything, and `result` is `null` while it is still warming up. `signal` appears for indicators that derive a trend from their result.

An indicator that reads a candle field the input does not carry is reported as an error rather than computed from missing values. One that stays silent although the input is long enough is flagged with a `hint`: either it emits only at an event the data does not contain, such as a swing or a breakout, or a setting never reached it.
