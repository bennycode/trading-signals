import type {NextConfig} from 'next';

const isCI = process.env.CI === 'true';
// GitHub Pages will serve from https://<user>.github.io/<repo>
// This docs site lives under the repo "trading-signals"
const repoName = 'trading-signals';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'export',
  trailingSlash: true,
  // Configure basePath and assetPrefix only in CI (GitHub Pages) to keep local dev URLs clean
  ...(isCI
    ? {
        basePath: `/${repoName}`,
        assetPrefix: `/${repoName}/`,
      }
    : {}),
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
