import { defineConfig } from "@playwright/test";
import { MIX_PATH, WORKERS, backendPort, frontendPort } from "./e2e/stack";

// One backend and one frontend per worker, each on that worker's database. A
// worker resets its database before each test with POST /test/reset. `next dev`
// reads the API addresses when it starts, so each worker runs a frontend of its
// own.
const stacks = Array.from({ length: WORKERS }, (_, i) => [
  {
    // SMTP_FROM and SMTP_NAME are read when a message is sent. :e2e delivers
    // to Swoosh's test adapter, but the mailer still needs a sender address to
    // build the invitation.
    command: `export PATH="${MIX_PATH}" && cd ../backend && MIX_ENV=e2e E2E_WORKER=${i} PHX_CONSUMER_URL=http://localhost:${frontendPort(i)} SMTP_FROM=no-reply@richardburton.test SMTP_NAME="Richard & Isabel Burton Platform" mix phx.server`,
    port: backendPort(i),
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  {
    command: `npm run dev -- --port ${frontendPort(i)}`,
    port: frontendPort(i),
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_API_URL: `http://localhost:${backendPort(i)}/api`,
      NEXT_INTERNAL_API_URL: `http://localhost:${backendPort(i)}/api`,
      // A build directory per worker, so the workers' `next dev`s do not
      // share `.next`.
      E2E_DIST_DIR: `.next-e2e-${i}`,
      // Google's public reCAPTCHA test key, so the suite needs no .env file.
      // No journey submits the contact form.
      NEXT_PUBLIC_GOOGLE_RECAPTCHA_SITEKEY:
        "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI",
    },
  },
]).flat();

export default defineConfig({
  testDir: "./e2e",
  workers: WORKERS,
  // Tests within a worker run one at a time, since each resets the database.
  fullyParallel: false,
  // CI runners are several times slower than a dev machine (2 vCPUs shared by
  // the stack, Postgres, and Chromium), so tests and assertions wait longer.
  timeout: process.env.CI ? 60_000 : 30_000,
  expect: { timeout: process.env.CI ? 15_000 : 5_000 },
  // One retry on CI absorbs tail-latency flakes. A retry starts from a reset
  // database like any run, and a test that passes on retry is reported as
  // "flaky".
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never" }]]
    : [["list"]],
  globalSetup: "./e2e/global-setup.ts",
  webServer: stacks,
  use: {
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
});
