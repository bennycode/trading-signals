import Link from 'next/link';

export default function Home() {
  const categories = [
    {
      name: 'Trend Indicators',
      description: 'Measure the direction of a trend (uptrend, downtrend or sideways trend)',
      href: '/indicators/trend',
      icon: '📈',
      indicators: ['SMA', 'EMA', 'DEMA', 'WMA', 'MACD', 'ADX', 'PSAR', 'VWAP'],
      color: 'from-blue-500 to-cyan-500',
    },
    {
      name: 'Momentum Indicators',
      description: 'Measure the speed and strength of price movements',
      href: '/indicators/momentum',
      icon: '⚡',
      indicators: ['RSI', 'Stochastic', 'CCI', 'ROC', 'AO', 'AC', 'MOM', 'OBV'],
      color: 'from-purple-500 to-pink-500',
    },
    {
      name: 'Volatility Indicators',
      description: 'Measure the degree of variation in prices over time',
      href: '/indicators/volatility',
      icon: '🌊',
      indicators: ['Bollinger Bands', 'ATR', 'BBW', 'IQR', 'MAD', 'TR'],
      color: 'from-orange-500 to-red-500',
    },
    {
      name: 'Exhaustion Indicators',
      description: 'Identify trend exhaustion and potential reversal points',
      href: '/indicators/exhaustion',
      icon: '🎯',
      indicators: ['TDS (Tom Demark Sequential)'],
      color: 'from-green-500 to-emerald-500',
    },
    {
      name: 'Utility Functions',
      description: 'Mathematical utilities for technical analysis',
      href: '/indicators/utilities',
      icon: '🛠️',
      indicators: ['Average', 'Median', 'Standard Deviation', 'Min/Max', 'Quartiles'],
      color: 'from-slate-500 to-slate-600',
    },
  ];

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <div className="text-center space-y-4 py-12">
        <h1 className="text-5xl font-bold text-white">Trading Signals</h1>
        <p className="text-xl text-slate-300 max-w-2xl mx-auto">
          Technical indicators and overlays to run technical analysis with JavaScript / TypeScript
        </p>
        <div className="flex justify-center gap-4 mt-8">
          <a
            href="https://www.npmjs.com/package/trading-signals"
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
            View on NPM
          </a>
          <a
            href="https://github.com/bennycode/trading-signals"
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors font-medium">
            View on GitHub
          </a>
        </div>
      </div>

      {/* Features */}
      <div className="grid md:grid-cols-3 gap-6 mb-12">
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <div className="text-3xl mb-3">🚀</div>
          <h3 className="text-lg font-semibold text-white mb-2">High Performance</h3>
          <p className="text-slate-400">
            Native JavaScript numbers for ~100x faster calculations compared to arbitrary precision libraries
          </p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <div className="text-3xl mb-3">📊</div>
          <h3 className="text-lg font-semibold text-white mb-2">Streaming Data</h3>
          <p className="text-slate-400">
            Update indicators incrementally as new prices arrive - perfect for real-time trading
          </p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <div className="text-3xl mb-3">🔒</div>
          <h3 className="text-lg font-semibold text-white mb-2">Type Safe</h3>
          <p className="text-slate-400">
            Full TypeScript implementation with complete type definitions and IDE support
          </p>
        </div>
      </div>

      {/* Indicator Categories */}
      <div>
        <h2 className="text-3xl font-bold text-white mb-6">Indicator Categories</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map(category => (
            <Link
              key={category.href}
              href={category.href}
              className="group block bg-slate-800/50 border border-slate-700 rounded-lg p-6 hover:border-slate-500 transition-all hover:shadow-lg hover:shadow-slate-700/50">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl">{category.icon}</span>
                <h3 className="text-xl font-semibold text-white group-hover:text-blue-400 transition-colors">
                  {category.name}
                </h3>
              </div>
              <p className="text-slate-400 text-sm mb-4">{category.description}</p>
              <div className="flex flex-wrap gap-2">
                {category.indicators.slice(0, 4).map(indicator => (
                  <span key={indicator} className="px-2 py-1 bg-slate-700/50 text-slate-300 text-xs rounded font-mono">
                    {indicator}
                  </span>
                ))}
                {category.indicators.length > 4 && (
                  <span className="px-2 py-1 text-slate-400 text-xs">+{category.indicators.length - 4} more</span>
                )}
              </div>
              <div className="mt-4 text-blue-400 text-sm font-medium group-hover:underline">View indicators →</div>
            </Link>
          ))}
        </div>
      </div>

      {/* Quick Start */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-8">
        <h2 className="text-2xl font-bold text-white mb-4">Quick Start</h2>
        <div className="space-y-4">
          <div>
            <p className="text-slate-400 mb-2">Install the package:</p>
            <pre className="bg-slate-900 border border-slate-700 rounded p-4 overflow-x-auto">
              <code className="text-green-400">npm install trading-signals</code>
            </pre>
          </div>
          <div>
            <p className="text-slate-400 mb-2">Use it in your code:</p>
            <pre className="bg-slate-900 border border-slate-700 rounded p-4 overflow-x-auto text-sm">
              <code className="text-slate-300">
                {`import { SMA } from 'trading-signals';

const sma = new SMA(5);

sma.add(81);
sma.add(24);
sma.add(75);
sma.add(21);
sma.add(34);

console.log(sma.getResult()); // 47`}
              </code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
