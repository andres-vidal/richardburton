const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Per-process build dir so parallel E2E `next dev` workers don't collide on a
  // shared `.next` (each Playwright worker sets E2E_DIST_DIR). Defaults to `.next`.
  distDir: process.env.E2E_DIST_DIR || ".next",

  // Import SVGs as React components. Turbopack (Next 16's default bundler) runs
  // the @svgr/webpack loader via turbopack.rules; the webpack block is the
  // equivalent for `next build --webpack`.
  turbopack: {
    rules: {
      "*.svg": {
        loaders: ["@svgr/webpack"],
        as: "*.js",
      },
    },
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

  // Silence the multi-lockfile "inferred workspace root" warning.
  outputFileTracingRoot: path.join(__dirname),
  output: "standalone",
};

module.exports = nextConfig;
