import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import react from "@vitejs/plugin-react";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import magicalSvg from "vite-plugin-magical-svg";
import tsconfigPaths from "vite-tsconfig-paths";
import { configDefaults, defineConfig } from "vitest/config";

const dir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    // Track-only coverage baseline (no thresholds yet). Scoped to the client
    // source the suite exercises; the Next.js `app/` shell is covered by the
    // build/integration path, not unit tests, so it's left out here.
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
        // Plain unit/hook/component tests in jsdom.
        plugins: [tsconfigPaths(), react(), magicalSvg({ target: "react" })],
        test: {
          name: "unit",
          environment: "jsdom",
          globals: true,
          include: ["**/*.spec.{ts,tsx}"],
          // Playwright specs (frontend/e2e) run under `npm run test:e2e`, not Vitest.
          exclude: [...configDefaults.exclude, "e2e/**"],
        },
      },
      {
        // Every story runs as a test in a real (headless) browser. Storybook's
        // own Vite config (framework + viteFinal) resolves paths and SVGs for
        // these, so we deliberately don't add those plugins again here — doing
        // so double-loads magical-svg and breaks its raw-SVG import.
        plugins: [storybookTest({ configDir: join(dir, ".storybook") })],
        test: {
          name: "storybook",
          // Test-only tweaks (e.g. disabling framer-motion animations) that must
          // not leak into interactive Storybook, which never loads this file.
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
