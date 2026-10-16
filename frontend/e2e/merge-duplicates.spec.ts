import type { Locator, Page } from "@playwright/test";

import { test, expect } from "./fixtures";
import {
  addPublicationRow,
  expectPublicationCount,
  indexTable,
  openPublicationModal,
  seedCorpus,
  submitWorkspace,
  CORPUS_SIZE,
  historyEntries,
  notifications,
  openDocument,
} from "./helpers";

// The record the corpus seeds, and the two the journey enters beside it: the
// same translation, entered again by people who each knew a different part of
// it. Each adds a country and a publisher the stored record lacks. Together
// they are what a merge is for.
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

const BRAZILIAN_PRINTING = {
  title: CANONICAL,
  originalTitle: "Dom Casmurro",
  year: "1953",
  authors: "Helen Caldwell",
  originalAuthors: "Machado de Assis",
  country: "Brazil",
  publisher: "Livraria Garnier",
};

// The notes each duplicate is entered with. The merge dialog proposes both,
// and the journey edits them into `EDITED_NOTES` before merging: the second
// sentence goes, and the first gains a word.
const BRITISH_NOTES = "Bought from the publisher's remaindered stock.";
const BRAZILIAN_NOTES = "Garnier's copy, stamped by the bookseller.";
const EDITED_NOTES = "Bought from the publisher's remaindered stock, signed.";

// Types `text` as the notes of the open document's row that names
// `publisher`, in the row's notes editor, and closes the editor.
async function writeNotes(page: Page, publisher: string, text: string) {
  const row = indexTable(page).getByRole("row").filter({ hasText: publisher });

  await row.getByRole("button", { name: "Add notes" }).click();
  const editor = page.getByRole("dialog", { name: "Edit notes" });
  await editor.getByRole("textbox", { name: "Notes" }).click();
  await page.keyboard.type(text);
  await page.keyboard.press("Escape");
  await expect(
    row.getByRole("button", { name: `Edit notes: ${text}` }),
  ).toBeVisible();
}

// Picks, in the merge dialog `merge`, the record on offer that names
// `publisher`.
async function pick(merge: Locator, publisher: string) {
  await merge
    .getByRole("listitem")
    .filter({ hasText: publisher })
    .getByRole("button", { name: "Add" })
    .click();
}

test("an admin merges duplicate records into one; it keeps its place and gains what they held", async ({
  page,
}) => {
  await seedCorpus(page);

  // Two more records of the translation the corpus already holds, each with
  // notes of its own.
  await openDocument(page);
  await addPublicationRow(page, BRITISH_PRINTING);
  await addPublicationRow(page, BRAZILIAN_PRINTING);
  await writeNotes(page, BRITISH_PRINTING.publisher, BRITISH_NOTES);
  await writeNotes(page, BRAZILIAN_PRINTING.publisher, BRAZILIAN_NOTES);
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
  await pick(merge, BRITISH_PRINTING.publisher);
  await pick(merge, BRAZILIAN_PRINTING.publisher);

  // The survivor has no notes of its own, so the dialog proposes the notes of
  // the two records it takes in, one paragraph each, in the order they were
  // picked.
  const proposed = merge.getByRole("textbox", { name: "Notes" });
  await expect(proposed.locator("p")).toHaveText([
    BRITISH_NOTES,
    BRAZILIAN_NOTES,
  ]);

  // The notes are edited before the merge. A triple click selects the second
  // paragraph. Backspace deletes its text, then the empty paragraph, then the
  // full stop of the first paragraph, and the typing adds a word.
  await proposed.locator("p").nth(1).click({ clickCount: 3 });
  await page.keyboard.press("Backspace");
  await page.keyboard.press("Backspace");
  await page.keyboard.press("Backspace");
  await page.keyboard.type(", signed.");
  await expect(proposed.locator("p")).toHaveText([EDITED_NOTES]);

  await merge.getByRole("button", { name: "Merge 2 publications" }).click();

  await expect(notifications(page)).toContainText(/Merged 2 publications/);

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
    "United States",
    "Noonday Press",
    "W. H. Allen",
    "Livraria Garnier",
  ]) {
    await expect(merged.getByRole("link", { name: value })).toBeVisible();
  }

  // The record holds the notes as they were edited in the dialog, and nothing
  // else of the notes the two records held.
  const notes = merged.getByRole("region", { name: "Notes" });
  await expect(notes.locator("p")).toHaveText([EDITED_NOTES]);

  // The record's own log carries the merge, on the record that survived it.
  await merged.getByText("History").click();
  const mergeEntry = historyEntries(merged, "merged").first();
  await expect(mergeEntry).toBeVisible();
  await expect(mergeEntry).toContainText("Took in");
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

  // The feed carries the merge as one entry, however many records it took in,
  // and says which they were.
  await page.goto("/admin/publications/history");
  const mergedEntries = historyEntries(page, "merged");
  await expect(mergedEntries).toHaveCount(1);
  await expect(mergedEntries.first()).toContainText(CANONICAL);
  await expect(mergedEntries.first()).toContainText("Took in");

  // The trash stays empty: nobody deleted those records, a merge absorbed them,
  // and they come back by taking the merge apart rather than being restored.
  await page.goto("/admin/publications/deleted");
  await expect(
    page.getByText("no publication is currently deleted"),
  ).toBeVisible();

  // One act, so one thing to undo — and undoing it gives back everything the
  // merge took, at once.
  await page.goto("/admin/publications/history");
  await mergedEntries.first().getByRole("button", { name: "Undo" }).click();

  await expect(historyEntries(page, "unmerged").first()).toContainText(
    "Gave back",
  );

  // The records that left are in the database again, and the survivor has
  // given up what it had absorbed.
  await page.goto("/");
  await expectPublicationCount(page, CORPUS_SIZE + 2);
  await expect(
    indexTable(page).getByRole("row").filter({ hasText: CANONICAL }),
  ).toHaveCount(3);

  // The survivor, the only one of the three that Noonday Press published, had
  // no notes before the merge, and has none again.
  await indexTable(page)
    .getByRole("row")
    .filter({ hasText: CANONICAL })
    .filter({ hasText: "Noonday Press" })
    .click();
  const restored = page.getByRole("dialog", { name: "Publication details" });
  await expect(restored).toBeVisible();
  await expect(
    restored.getByRole("link", { name: "Noonday Press" }),
  ).toBeVisible();
  await expect(restored.getByRole("region", { name: "Notes" })).toHaveCount(0);
});
