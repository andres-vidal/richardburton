import { test, expect } from "./fixtures";
import { seedCorpus, expectPublicationCount, CORPUS_SIZE } from "./helpers";

test("a link to nothing lands on a page, not a broken document", async ({
  page,
}) => {
  await seedCorpus(page);

  const answer = await page.goto("/a-page-that-never-existed");
  expect(answer?.status()).toBe(404);

  // The app's own chrome, not Next's bare fallback.
  await expect(
    page.getByRole("heading", { name: "No such page" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();

  // And the way back works.
  await page.getByRole("link", { name: "Browse the database" }).click();
  await expect(page).toHaveURL("/en");
  await expectPublicationCount(page, CORPUS_SIZE);
});

test("a publication that is not there says so in the reader's language", async ({
  page,
}) => {
  await page.goto("/pt");

  // Nothing has been inserted, so no id resolves.
  const answer = await page.goto("/pt/publications/404404");
  expect(answer?.status()).toBe(404);

  await expect(
    page.getByRole("heading", { name: "Página inexistente" }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "pt");
});
