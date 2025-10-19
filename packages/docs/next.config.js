/** @type {import('next').NextConfig} */
const isCI = process.env.CI === 'true';
// GitHub Pages will serve from https://<user>.github.io/<repo>
// This docs site lives under the repo "trading-signals"
const repoName = 'trading-signals';

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['trading-signals'],
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

module.exports = nextConfig;
