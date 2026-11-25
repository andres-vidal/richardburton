import {
  test as base,
  expect,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { installFakeTranslator } from "../test/translator";
import { backendPort, frontendPort } from "./stack";

/** Removes the browser's Translator API from the page it runs in. */
function removeTranslator() {
  delete (self as { Translator?: unknown }).Translator;
}

/**
 * Playwright's `test`, run against the stack of the test's worker, with that
 * worker's database reset before every test.
 *
 * Playwright's Chromium has the built-in Translator API, but no translation
 * service behind it, so the API never answers. Every page gets the fake one
 * that `installFakeTranslator` describes before its scripts run. A test about
 * a browser without the API uses `test.use({ translator: false })`, which
 * removes the API from the page instead.
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
    await page.addInitScript(
      translator ? installFakeTranslator : removeTranslator,
    );
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
    await page.addInitScript(
      translator ? installFakeTranslator : removeTranslator,
    );
    await use(page);
  },
});

export { expect };
