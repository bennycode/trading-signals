import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /*
   * TypeScript 7 ships as a Go binary with no JavaScript compiler API, which is what Next reaches
   * for by default. This routes build-time type checking and config loading through the tsc CLI.
   */
  experimental: {
    useTypeScriptCli: true,
  },
  images: {
    unoptimized: true,
  },
  output: 'export',
  reactStrictMode: true,
  trailingSlash: true,
  transpilePackages: ['trading-strategies', '@typedtrader/exchange', 'highcharts', '@highcharts/react'],
};

export default nextConfig;
