import type {AppProps} from 'next/app';
import Link from 'next/link';
import {useRouter} from 'next/router';
import '../styles/globals.css';

export default function App({Component, pageProps}: AppProps) {
  const router = useRouter();

  const navigation = [
    {name: 'Home', href: '/'},
    {name: 'Trend', href: '/indicators/trend'},
    {name: 'Momentum', href: '/indicators/momentum'},
    {name: 'Volatility', href: '/indicators/volatility'},
    {name: 'Exhaustion', href: '/indicators/exhaustion'},
    {name: 'Utilities', href: '/indicators/utilities'},
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <nav className="border-b border-slate-700 bg-slate-900/50 backdrop-blur-sm">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-8">
              <Link href="/" className="text-xl font-bold text-blue-400">
                Trading Signals
              </Link>
              <div className="hidden md:flex space-x-4">
                {navigation.map(item => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      router.pathname === item.href
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}>
                    {item.name}
                  </Link>
                ))}
              </div>
            </div>
            <a
              href="https://github.com/bennycode/trading-signals"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-300 hover:text-white transition-colors">
              <span className="sr-only">GitHub</span>
              <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                <path
                  fillRule="evenodd"
                  d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                  clipRule="evenodd"
                />
              </svg>
            </a>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8">
        <Component {...pageProps} />
        <div className="bg-yellow-900/20 border border-yellow-800/50 rounded-lg p-6 mt-8">
          <h2 className="text-xl font-semibold text-yellow-400 mb-3">⚠️ Important Disclaimer</h2>
          <p className="text-slate-300">
            Signals by technical trading indicators are not guarantees. Always use proper risk management, confirm
            signals with multiple indicators, and never rely on a single indicator for trading decisions. This library
            is for educational purposes and does not constitute financial advice.
          </p>
        </div>
      </main>

      <footer className="border-t border-slate-700 mt-16 py-8">
        <div className="container mx-auto px-4 text-center text-slate-400">
          <p>
            Built with ❤️ by{' '}
            <a
              href="https://github.com/sponsors/bennycode"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300">
              Benny Neugebauer
            </a>
          </p>
          <p className="mt-2 text-sm">MIT Licensed | Not financial advice - for educational purposes only</p>
        </div>
      </footer>
    </div>
  );
}
