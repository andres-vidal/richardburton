import {
  test as base,
  expect,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { installFakeTranslator } from "../test/translator";
import { backendPort, frontendPort } from "./stack";

/**
 * Playwright's `test`, run against the stack of the test's worker, with that
 * worker's database reset before every test.
 *
 * Playwright's Chromium has no built-in Translator API, so every page gets the
 * fake one that `installFakeTranslator` describes before its scripts run. A
 * test about a browser without the API turns it off with
 * `test.use({ translator: false })`.
 */
export const test = base.extend<{
  reset: void;
  translator: boolean;
  colleagueContext: BrowserContext;
  colleague: Page;
}>({
  translator: [true, { option: true }],

  // Navigation goes to this worker's frontend.
  baseURL: async ({}, use, testInfo) => {
    await use(`http://localhost:${frontendPort(testInfo.parallelIndex)}`);
  },

  page: async ({ page, translator }, use) => {
    if (translator) await page.addInitScript(installFakeTranslator);
    await use(page);
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

  colleague: async ({ colleagueContext, translator }, use) => {
    const page = await colleagueContext.newPage();
    if (translator) await page.addInitScript(installFakeTranslator);
    await use(page);
  },
});

export { expect };
