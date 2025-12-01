import Link from 'next/link';
import {CategoryCard} from '../components/CategoryCard';
import {FeatureCard} from '../components/FeatureCard';
import {Hero} from '../components/Hero';
import {QuickStart} from '../components/QuickStart';

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
      name: 'Utility Functions',
      description: 'Mathematical utilities for technical analysis',
      href: '/indicators/utilities',
      icon: '🛠️',
      indicators: ['Average', 'Median', 'Standard Deviation', 'Min/Max', 'Quartiles'],
      color: 'from-slate-500 to-slate-600',
    },
  ];

  const features = [
    {
      icon: '🚀',
      title: 'Streaming Updates',
      description: 'Update indicators incrementally as new prices arrive - no need to reprocess historical data',
    },
    {
      icon: '📊',
      title: 'Replace Mode',
      description: 'Efficiently update live charts by replacing the most recent value without full recalculation',
    },
    {
      icon: '🔒',
      title: 'Type Safe',
      description: 'Full TypeScript implementation with complete type definitions and IDE support',
    },
    {
      icon: '⚡',
      title: 'Lazy Evaluation',
      description: 'Indicators only calculate when stable - check readiness with built-in stability flags',
    },
    {
      icon: '💾',
      title: 'Memory Efficient',
      description: 'Rolling windows instead of full history storage - minimal memory footprint',
    },
    {
      icon: '📦',
      title: 'Zero Dependencies',
      description: 'No runtime dependencies and minimal bundle size - perfect for web and Node.js',
    },
  ];

  return (
    <div className="space-y-12">
      <Hero
        title="Trading Signals"
        description="Technical indicators and overlays to run technical analysis with JavaScript / TypeScript"
        npmUrl="https://www.npmjs.com/package/trading-signals"
        githubUrl="https://github.com/bennycode/trading-signals"
      />

      {/* Features */}
      <div className="grid md:grid-cols-3 gap-6 mb-12">
        {features.map(feature => (
          <FeatureCard key={feature.title} icon={feature.icon} title={feature.title} description={feature.description} />
        ))}
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
