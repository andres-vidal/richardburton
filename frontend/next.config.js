/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,

  // Lint the whole source tree, not just next's defaults (pages/components) —
  // `modules` (the state layer) and `utils` were previously unchecked in CI.
  eslint: {
    dirs: ["pages", "components", "modules", "utils"],
  },

  webpack(config) {
    config.module.rules.push({
      test: /\.svg$/i,
      issuer: /\.[jt]sx?$/,
      use: ["@svgr/webpack"],
    });

    return config;
  },

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/a/**",
      },
    ],
  },
  output: "standalone",
};

module.exports = nextConfig;
