import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  output: 'export',
  reactStrictMode: true,
  trailingSlash: true,
  transpilePackages: ['trading-strategies', '@typedtrader/exchange'],
};

export default nextConfig;
