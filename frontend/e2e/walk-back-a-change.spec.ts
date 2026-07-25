import { test, expect } from "./fixtures";
import {
  expectPublicationCount,
  expectPublicationRow,
  indexTable,
  seedCorpus,
  CORPUS_SIZE,
} from "./helpers";

// The record this journey imports, un-imports, and brings back. Field-for-field
// the same publication the corpus CSV seeds (GB renders as its display label).
const IRACEMA = {
  title: "Iraçéma the Honey-Lips",
  originalTitle: "Iracema",
  year: "1886",
  authors: "Isabel Burton",
  originalAuthors: "José de Alencar",
  country: "United Kingdom",
  publisher: "Bickers & Son",
};

test("an admin undoes an import from the history feed, then undoes the undo", async ({
  page,
}) => {
  await seedCorpus(page);

  // Scoped by action *and* title: after the round trip below, three entries in
  // the feed name this same record.
  const entryFor = (action: string) =>
    page
      .locator(`li[data-action="${action}"]`)
      .filter({ hasText: IRACEMA.title });

  await page.goto("/admin/publications/history");

  // A fresh import is its record's latest entry, so every one is undoable.
  await expect(page.locator('li[data-action="created"]')).toHaveCount(
    CORPUS_SIZE,
  );

  // Undoing an import deletes the record — the compensating action, chosen by
  // the server from the entry alone.
  await entryFor("created").getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText("Change undone")).toBeVisible();

  // The undo is itself an event: the import is still in the log, but is now
  // settled — a later entry has superseded it.
  await expect(entryFor("deleted")).toBeVisible();
  await expect(
    entryFor("created").getByRole("button", { name: "Undo" }),
  ).toHaveCount(0);

  await page.goto("/");
  await expectPublicationCount(page, CORPUS_SIZE - 1);
  await expect(
    indexTable(page).getByRole("row").filter({ hasText: IRACEMA.title }),
  ).toHaveCount(0);

  // It went to the trash, exactly as the Delete button would have left it.
  await page.goto("/admin/publications/deleted");
  await expect(
    page.getByRole("listitem").filter({ hasText: IRACEMA.title }),
  ).toBeVisible();

  // Now undo the undo: a delete is compensated by a restore, and nothing about
  // this being an undo's own entry makes it special.
  await page.goto("/admin/publications/history");
  await entryFor("deleted").getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText("Change undone")).toBeVisible();

  await page.goto("/");
  await expectPublicationCount(page, CORPUS_SIZE);
  await expectPublicationRow(page, IRACEMA);

  await page.goto("/admin/publications/deleted");
  await expect(
    page.getByText("no publication is currently deleted"),
  ).toBeVisible();

  // Three entries for one record, none rewritten: the log only ever grew.
  await page.goto("/admin/publications/history");
  await expect(entryFor("created")).toHaveCount(1);
  await expect(entryFor("deleted")).toHaveCount(1);
  await expect(entryFor("restored")).toHaveCount(1);
});
