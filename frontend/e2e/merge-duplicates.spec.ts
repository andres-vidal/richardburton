import { test, expect } from "./fixtures";
import {
  addPublicationRow,
  expectPublicationCount,
  indexTable,
  openPublicationModal,
  seedCorpus,
  submitWorkspace,
  CORPUS_SIZE,
} from "./helpers";

// The record the corpus seeds, and the two the journey enters beside it: the
// same translation, entered again by people who each knew a different part of
// it. One adds a country, a publisher and a source; the other adds only a
// source. Together they are what a merge is for.
const CANONICAL = "Dom Casmurro";

const BRITISH_PRINTING = {
  title: CANONICAL,
  originalTitle: "Dom Casmurro",
  year: "1953",
  authors: "Helen Caldwell",
  originalAuthors: "Machado de Assis",
  country: "United Kingdom",
  publisher: "W. H. Allen",
};

const SOURCED_COPY = {
  title: CANONICAL,
  originalTitle: "Dom Casmurro",
  year: "1953",
  authors: "Helen Caldwell",
  originalAuthors: "Machado de Assis",
  country: "Brazil",
  publisher: "Livraria Garnier",
};

test("an admin merges duplicate records into one; it keeps its place and gains what they held", async ({
  page,
}) => {
  await seedCorpus(page);

  // Two more records of the book the corpus already holds, each with a source
  // of its own so the merge has provenance to reconcile.
  await page.goto("/admin/publications/new");
  await addPublicationRow(page, BRITISH_PRINTING);
  await addPublicationRow(page, SOURCED_COPY);
  await submitWorkspace(page, 2);

  await page.goto("/");
  await expectPublicationCount(page, CORPUS_SIZE + 2);
  await expect(
    indexTable(page).getByRole("row").filter({ hasText: CANONICAL }),
  ).toHaveCount(3);

  // The merge is asked from the record that survives it: the one the corpus
  // seeded, published in the US by Noonday Press.
  const details = await openPublicationModal(page, CANONICAL);
  await details.getByRole("button", { name: "Merge" }).click();

  const merge = page.getByRole("dialog", { name: "Merge publications" });
  await expect(merge).toBeVisible();
  await expect(merge).toContainText(CANONICAL);
  // Nothing picked yet, so there is nothing to ask for.
  await expect(
    merge.getByRole("button", { name: "Merge publication" }),
  ).toBeDisabled();

  // Searching offers the duplicates and never the record being merged into:
  // three rows carry this title, and only two are on offer.
  await merge
    .getByRole("textbox", { name: "Search for publications to merge" })
    .fill(CANONICAL);
  const offered = merge.getByRole("button", { name: "Add" });
  await expect(offered).toHaveCount(2);

  // Taking one shows what the record becomes, before it becomes it.
  await offered.first().click();
  await expect(merge.getByText("Result")).toBeVisible();
  await expect(offered).toHaveCount(1);

  // Taking the second too: both are listed as merging in, and the button
  // counts them.
  await offered.first().click();
  await expect(merge.getByRole("button", { name: "Remove" })).toHaveCount(2);
  const confirm = merge.getByRole("button", { name: "Merge 2 publications" });
  await expect(confirm).toBeEnabled();

  // Backing out abandons the picks: the dialog reopens knowing nothing.
  await merge.getByRole("button", { name: "Cancel" }).click();
  await expect(merge).toHaveCount(0);
  await details.getByRole("button", { name: "Merge" }).click();
  await expect(
    merge.getByRole("button", { name: "Merge publication" }),
  ).toBeDisabled();

  await merge
    .getByRole("textbox", { name: "Search for publications to merge" })
    .fill(CANONICAL);
  await expect(merge.getByRole("button", { name: "Add" })).toHaveCount(2);
  await merge.getByRole("button", { name: "Add" }).first().click();
  await merge.getByRole("button", { name: "Add" }).first().click();
  await merge.getByRole("button", { name: "Merge 2 publications" }).click();

  await expect(
    page.locator("section[aria-label='Notifications']"),
  ).toContainText(/Merged 2 publications/);

  // One record where there were three, and it holds every country and
  // publisher the three of them named.
  await page.goto("/");
  await expectPublicationCount(page, CORPUS_SIZE);
  const survivor = indexTable(page)
    .getByRole("row")
    .filter({ hasText: CANONICAL });
  await expect(survivor).toHaveCount(1);

  // Each is a search link in the record's own sentence — the history section
  // below repeats the same words as a diff, so the sentence is what is asked.
  const merged = await openPublicationModal(page, CANONICAL);
  for (const value of [
    "Brazil",
    "United Kingdom",
    "United States of America",
    "Noonday Press",
    "W. H. Allen",
    "Livraria Garnier",
  ]) {
    await expect(merged.getByRole("link", { name: value })).toBeVisible();
  }

  // The log tells the survivor's side of it as an ordinary update, and the
  // merge itself is not on offer to undo.
  await merged.getByText("History").click();
  await expect(
    merged.locator('li[data-action="updated"]').first(),
  ).toBeVisible();
  await page.keyboard.press("Escape");

  // Search agrees the duplicates are gone: the title finds one row, and the
  // publisher only one of them named finds that same row.
  const search = page.getByRole("textbox", { name: "Search publications" });
  await search.fill(CANONICAL);
  await expect(
    indexTable(page).getByRole("row").filter({ hasText: CANONICAL }),
  ).toHaveCount(1);
  await search.fill("W. H. Allen");
  await expect(
    indexTable(page).getByRole("row").filter({ hasText: CANONICAL }),
  ).toHaveCount(1);
  await search.clear();

  // The feed keeps both merges, attributed and refusing to be undone.
  await page.goto("/admin/publications/history");
  const mergedEntries = page.locator('li[data-action="merged"]');
  await expect(mergedEntries).toHaveCount(2);
  await expect(mergedEntries.first()).toContainText(CANONICAL);
  await expect(
    mergedEntries.first().getByRole("button", { name: "Undo" }),
  ).toHaveCount(0);

  // And the trash stays empty: nobody deleted those records, a merge absorbed
  // them, and there is no putting one back.
  await page.goto("/admin/publications/deleted");
  await expect(
    page.getByText("no publication is currently deleted"),
  ).toBeVisible();
});
