import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import react from "@vitejs/plugin-react";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import svgr from "vite-plugin-svgr";
import { configDefaults, defineConfig } from "vitest/config";

const dir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    // Coverage of the client code the suites exercise, reported without
    // thresholds. The `app/` routes are left out.
    coverage: {
      provider: "v8",
      // json-summary feeds the PR coverage comment (run-frontend-tests.yml).
      reporter: ["text", "html", "json-summary"],
      include: [
        "components/**/*.{ts,tsx}",
        "modules/**/*.{ts,tsx}",
        "utils/**/*.{ts,tsx}",
      ],
      exclude: ["**/*.spec.{ts,tsx}", "**/*.stories.{ts,tsx}", "**/*.d.ts"],
    },
    projects: [
      {
        // Unit, hook and component specs in jsdom. Imports resolve as the
        // app's tsconfig paths say, and an SVG imports as a React component,
        // as in the app and in Storybook.
        resolve: { tsconfigPaths: true },
        plugins: [
          react(),
          svgr({ include: "**/*.svg", svgrOptions: { exportType: "default" } }),
        ],
        test: {
          name: "unit",
          environment: "jsdom",
          globals: true,
          setupFiles: [join(dir, "test/unit.setup.ts")],
          include: ["**/*.spec.{ts,tsx}"],
          // The Playwright specs in e2e/ run under `npm run test:e2e`.
          exclude: [...configDefaults.exclude, "e2e/**"],
          // next-intl ships ESM that imports `next/navigation` without an
          // extension, which Node will not resolve on its own. Inlining it hands
          // the resolution to Vite, which reads the package's own exports.
          server: { deps: { inline: ["next-intl"] } },
        },
      },
      {
        // Every story, run as a test in headless Chromium. Storybook's own
        // Vite config (.storybook/main.ts) resolves paths and SVGs for these,
        // so this project adds no plugins of its own.
        plugins: [storybookTest({ configDir: join(dir, ".storybook") })],
        test: {
          name: "storybook",
          // Settings for the tests only, which interactive Storybook never
          // loads.
          setupFiles: [join(dir, ".storybook/vitest.setup.ts")],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});
