import { CategoryCard } from '../components/CategoryCard';
import { Hero } from '../components/Hero';
import { MarketClock } from '../components/MarketClock';
import { QuickStart } from '../components/QuickStart';

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
      name: 'Volume Indicators',
      description: 'Analyze trading volume to confirm trends and identify reversals',
      href: '/indicators/volume',
      icon: '📊',
      indicators: ['AD', 'CMF', 'PVT', 'EMV', 'VROC', 'VWMA'],
      color: 'from-emerald-500 to-teal-500',
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
      <div>
        <Hero
          title="Trading Signals"
          description="Technical indicators and overlays to run technical analysis with JavaScript / TypeScript"
          npmUrl="https://www.npmjs.com/package/trading-signals"
          githubUrl="https://github.com/bennycode/trading-signals"
        />
        <MarketClock />
      </div>

      {/* Indicator Categories */}
      <div>
        <h2 className="text-3xl font-bold text-white mb-6">Indicator Categories</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map(category => (
            <CategoryCard
              key={category.href}
              name={category.name}
              description={category.description}
              href={category.href}
              icon={category.icon}
              indicators={category.indicators}
            />
          ))}
        </div>
      </div>

      <QuickStart />
    </div>
  );
}
