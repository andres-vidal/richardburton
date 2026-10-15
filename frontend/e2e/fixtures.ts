import {
  test as base,
  expect,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { backendPort, frontendPort } from "./stack";

/**
 * Playwright's `test`, run against the stack of the test's worker, with that
 * worker's database reset before every test.
 */
export const test = base.extend<{
  reset: void;
  colleagueContext: BrowserContext;
  colleague: Page;
}>({
  // Navigation goes to this worker's frontend.
  baseURL: async ({}, use, testInfo) => {
    await use(`http://localhost:${frontendPort(testInfo.parallelIndex)}`);
  },

  // Runs before every test: resets this worker's database with
  // POST /test/reset.
  reset: [
    async ({ request }, use, testInfo) => {
      const res = await request.post(
        `http://localhost:${backendPort(testInfo.parallelIndex)}/test/reset`,
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
