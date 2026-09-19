interface PackageInfo {
  blurb: string;
  href: string;
  linkLabel: string;
  name: string;
  role: string;
}

const PACKAGES: PackageInfo[] = [
  {
    blurb:
      'Over 120 streaming technical indicators with zero runtime dependencies. Feed prices in, read stable results out — the core of everything on this site.',
    href: 'https://www.npmjs.com/package/trading-signals',
    linkLabel: 'npm',
    name: 'trading-signals',
    role: 'Indicators',
  },
  {
    blurb:
      'Turns indicator readings into buy/sell advice. Ready-made strategies included, plus built-in stop-loss and take-profit protection for any custom one.',
    href: 'https://www.npmjs.com/package/trading-strategies',
    linkLabel: 'npm',
    name: 'trading-strategies',
    role: 'Strategies',
  },
  {
    blurb:
      'One typed API for different brokers: order execution, live candles over WebSocket, and paper trading. Alpaca is supported today, more can plug in.',
    href: 'https://www.npmjs.com/package/@typedtrader/exchange',
    linkLabel: 'npm',
    name: '@typedtrader/exchange',
    role: 'Broker access',
  },
  {
    blurb:
      'Drive your bot from Telegram: connect accounts, launch strategies through chat wizards, watch prices, and schedule recurring reports.',
    href: 'https://github.com/bennycode/trading-signals/tree/main/packages/messaging',
    linkLabel: 'GitHub',
    name: '@typedtrader/messaging',
    role: 'Remote control',
  },
  {
    blurb:
      'Synthetic market regimes and real symbol history as ready-to-use candle datasets — the data behind every demo and backtest on this site.',
    href: 'https://github.com/bennycode/trading-signals/tree/main/packages/candles',
    linkLabel: 'GitHub',
    name: '@typedtrader/candles',
    role: 'Datasets',
  },
];

export function PackageGrid() {
  return (
    <div className="not-prose grid md:grid-cols-2 gap-4">
      {PACKAGES.map(pkg => (
        <div key={pkg.name} className="demo-card flex flex-col">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h3 className="text-base font-semibold demo-heading font-mono">{pkg.name}</h3>
            <span className="shrink-0 px-1.5 py-0.5 rounded text-[11px] border border-(--demo-accent)/40 text-(--demo-accent)">
              {pkg.role}
            </span>
          </div>
          <p className="demo-muted text-sm mb-3 flex-1">{pkg.blurb}</p>
          <a href={pkg.href} className="text-sm text-(--demo-accent) no-underline hover:underline self-start">
            View on {pkg.linkLabel} →
          </a>
        </div>
      ))}
    </div>
  );
}
