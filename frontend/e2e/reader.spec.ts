import { test, expect } from "./fixtures";
import {
  seedCorpus,
  signInAsAdmin,
  submitWorkspace,
  indexTable,
  expectPublicationCount,
  CORPUS_SIZE,
} from "./helpers";

// Browse / search / columns against a seeded corpus, all through the UI.
test("browse the corpus, search, and toggle a column", async ({ page }) => {
  await seedCorpus(page);

  await page.goto("/");
  const table = indexTable(page);

  // The whole corpus is listed.
  await expectPublicationCount(page, CORPUS_SIZE);
  await expect(table.getByText("Epitaph of a Small Winner")).toBeVisible();
  await expect(table.getByText("Barren Lives")).toBeVisible();

  const search = page.getByRole("textbox", { name: "Search publications" });

  // Searching an author narrows to their three works.
  await search.fill("Machado");
  await expect(
    table.getByRole("row").filter({ hasText: "Machado de Assis" }),
  ).toHaveCount(3);
  await expect(table.getByText("Iraçéma the Honey-Lips")).toHaveCount(0);
  await expect(page).toHaveURL(/\?search=Machado/);

  // A distinctive title narrows to one.
  await search.fill("Gabriela");
  await expect(table.getByText("Gabriela, Clove and Cinnamon")).toBeVisible();
  await expect(table.getByText("Epitaph of a Small Winner")).toHaveCount(0);

  // Clearing restores the full corpus.
  await search.fill("");
  await expect(table.getByText("Barren Lives")).toBeVisible();

  // The Columns menu hides the Year column across every row.
  await expect(table.getByRole("columnheader", { name: "Year" })).toBeVisible();
  await page.getByRole("button", { name: "Columns" }).click();
  await page.getByRole("button", { name: "Year", pressed: true }).click();
  await expect(table.getByRole("columnheader", { name: "Year" })).toHaveCount(
    0,
  );
});

// 60 distinct publications, imported in one shot (titles carry the index so a
// specific far-away row is addressable).
const BULK_SIZE = 60;
const BULK_CSV =
  Array.from(
    { length: BULK_SIZE },
    (_, i) =>
      `Author ${i};${1900 + i};US;Original ${i};Bulk Title ${i};Translator ${i};Publisher ${i};`,
  ).join("\n") + "\n";

test("a large index virtualizes: far rows render as they scroll into view", async ({
  page,
}) => {
  await signInAsAdmin(page);
  await page.goto("/admin/publications/new");
  await page.locator("#upload-csv").setInputFiles({
    name: "bulk.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(BULK_CSV),
  });
  await submitWorkspace(page, BULK_SIZE);

  await page.goto("/");
  const table = indexTable(page);
  await expectPublicationCount(page, BULK_SIZE);

  // The last row exists but is virtualized: its cells are empty placeholders
  // until scrolled into view.
  await expect(table.getByText("Bulk Title 59")).toHaveCount(0);
  await table.getByRole("row").last().scrollIntoViewIfNeeded();
  await expect(table.getByText("Bulk Title 59")).toBeVisible();
});
