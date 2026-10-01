import {
  test as base,
  expect,
  type BrowserContext,
  type Page,
} from "@playwright/test";

const backendPort = (i: number) => 4100 + i;
const frontendPort = (i: number) => 3100 + i;

/** The backend base URL for the current worker (own database + port). */
export const backendUrl = (parallelIndex: number) =>
  `http://localhost:${backendPort(parallelIndex)}`;

// Each test runs against its worker's stack, and that worker's database is reset
// before every test — the DB-per-worker isolation contract.
export const test = base.extend<{
  reset: void;
  colleagueContext: BrowserContext;
  colleague: Page;
}>({
  // Point navigation at this worker's frontend.
  baseURL: async ({}, use, testInfo) => {
    await use(`http://localhost:${frontendPort(testInfo.parallelIndex)}`);
  },

  // Auto-run before every test: truncate + reseed this worker's database.
  reset: [
    async ({ request }, use, testInfo) => {
      const res = await request.post(
        `${backendUrl(testInfo.parallelIndex)}/test/reset`,
      );
      if (res.status() !== 204) {
        throw new Error(`/test/reset returned ${res.status()}`);
      }
      await use();
    },
    { auto: true },
  ],

  // A second person's browser context and page, for journeys with two people at
  // once. The context has its own cookies and storage. Playwright creates it
  // only for a test that uses `colleague` or `colleagueContext`, and closes it
  // when the test ends, whether the test passed or failed.
  colleagueContext: async ({ browser, baseURL }, use) => {
    const context = await browser.newContext({ baseURL });
    await use(context);
    await context.close();
  },

  colleague: async ({ colleagueContext }, use) => {
    await use(await colleagueContext.newPage());
  },
});

export { expect };
