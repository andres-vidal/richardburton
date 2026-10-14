const path = require("path");
const createNextIntlPlugin = require("next-intl/plugin");

const withNextIntl = createNextIntlPlugin();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Each Playwright worker runs its own `next dev` and sets E2E_DIST_DIR to a
  // build directory of its own, so the workers do not share `.next`.
  distDir: process.env.E2E_DIST_DIR || ".next",

  // An E2E build also writes its generated route types into tsconfig.e2e.json
  // rather than tsconfig.json, so `tsconfig.json` stays unchanged and `tsc`
  // does not type-check the E2E builds.
  typescript: process.env.E2E_DIST_DIR
    ? { tsconfigPath: "tsconfig.e2e.json" }
    : {},

  // Imports an SVG as a React component, with Turbopack, Next's default
  // bundler, and with webpack under `next build --webpack`.
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

  // Traces the files a standalone build needs from this directory, which also
  // silences the warning about several lockfiles.
  outputFileTracingRoot: path.join(__dirname),
  output: "standalone",
};

module.exports = withNextIntl(nextConfig);
