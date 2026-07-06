import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import react from "@vitejs/plugin-react";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import magicalSvg from "vite-plugin-magical-svg";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

const dir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [tsconfigPaths(), react(), magicalSvg({ target: "react" })],
  test: {
    projects: [
      {
        // Plain unit/hook/component tests in jsdom.
        extends: true,
        test: {
          name: "unit",
          environment: "jsdom",
          globals: true,
          include: ["**/*.spec.{ts,tsx}"],
        },
      },
      {
        // Every story runs as a test in a real (headless) browser.
        extends: true,
        plugins: [storybookTest({ configDir: join(dir, ".storybook") })],
        test: {
          name: "storybook",
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
