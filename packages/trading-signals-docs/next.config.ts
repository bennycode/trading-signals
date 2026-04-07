import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'export',
  trailingSlash: true,
  transpilePackages: ['trading-strategies', '@typedtrader/exchange'],
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
