import { defineConfig } from "@playwright/test";

// DB-per-worker isolation: each Playwright worker gets its own (backend, frontend)
// stack on distinct ports, backed by its own database (richard_burton_e2e{i}). A
// worker resets its database between tests via POST /test/reset. See
// docs/planning/22 and backend/config/e2e.exs.
const WORKERS = Number(process.env.E2E_WORKERS ?? "1");
const backendPort = (i: number) => 4100 + i;
const frontendPort = (i: number) => 3100 + i;
const asdf = `${process.env.HOME}/.asdf/shims`;

// One backend + one frontend per worker, each pointed at that worker's database.
// `next dev` reads the API URLs at runtime, so a single build can't serve several
// workers — hence a frontend per worker (kept small; scale via E2E_WORKERS).
const stacks = Array.from({ length: WORKERS }, (_, i) => [
  {
    // SMTP_FROM/SMTP_NAME are read at send time, so the invitation journey needs
    // them even though :e2e delivers to Swoosh's test adapter rather than a
    // server — without a sender address the mailer refuses to build the message.
    command: `export PATH="${asdf}:$PATH" && cd ../backend && MIX_ENV=e2e E2E_WORKER=${i} PHX_CONSUMER_URL=http://localhost:${frontendPort(i)} SMTP_FROM=no-reply@richardburton.test SMTP_NAME="Richard & Isabel Burton Platform" mix phx.server`,
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
      // A private build dir per worker so parallel `next dev`s don't share `.next`.
      E2E_DIST_DIR: `.next-e2e-${i}`,
      // Provided here so the harness doesn't depend on a local .env (absent in CI).
      // Google's public reCAPTCHA test key; the journeys don't submit the form.
      NEXT_PUBLIC_GOOGLE_RECAPTCHA_SITEKEY:
        "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI",
    },
  },
]).flat();

export default defineConfig({
  testDir: "./e2e",
  workers: WORKERS,
  // Tests within a worker run serially — each needs a clean database (reset).
  fullyParallel: false,
  // CI runners are several times slower than a dev machine (2 vCPUs shared by
  // the stack, Postgres, and Chromium) — give tests and assertions headroom.
  timeout: process.env.CI ? 60_000 : 30_000,
  expect: { timeout: process.env.CI ? 15_000 : 5_000 },
  // One retry on CI absorbs tail-latency flakes; the per-test database reset
  // makes a retry start from the same clean state as any run, and retried
  // passes are reported as "flaky" so they stay visible.
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
