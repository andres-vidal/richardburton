import { test, expect } from "./fixtures";
import {
  addPublicationRow,
  expectPublicationCount,
  expectPublicationRow,
  indexTable,
  openPublicationModal,
  seedCorpus,
  submitWorkspace,
  CORPUS_SIZE,
} from "./helpers";

// The record the journey deletes and later re-imports. Field-for-field the same
// publication the corpus CSV seeds (GB renders as its display label).
const IRACEMA = {
  title: "Iraçéma the Honey-Lips",
  originalTitle: "Iracema",
  year: "1886",
  authors: "Isabel Burton",
  originalAuthors: "José de Alencar",
  country: "United Kingdom",
  publisher: "Bickers & Son",
};

test("an admin deletes a publication; it leaves the index and search, and the same record can be imported again", async ({
  page,
}) => {
  await seedCorpus(page);
  await page.goto("/");
  await expectPublicationCount(page, CORPUS_SIZE);

  // The delete is guarded: the confirmation names the record, and cancelling
  // is consequence-free.
  const details = await openPublicationModal(page, IRACEMA.title);
  await details.getByRole("button", { name: "Delete" }).click();

  const confirmation = page.getByRole("dialog", {
    name: "Delete this publication?",
  });
  await expect(confirmation).toBeVisible();
  await expect(confirmation).toContainText(IRACEMA.title);
  await expect(confirmation).toContainText(IRACEMA.year);

  await confirmation.getByRole("button", { name: "Cancel" }).click();
  await expect(confirmation).toHaveCount(0);
  await expect(details).toBeVisible();

  // Close the details modal (the open dialog aria-hides the page behind it)
  // and check the record is untouched in the index.
  await page.keyboard.press("Escape");
  await expect(details).toHaveCount(0);
  await expectPublicationRow(page, IRACEMA);

  // Confirming deletes: toast, both dialogs close, and the row leaves the
  // index without a reload.
  const reopened = await openPublicationModal(page, IRACEMA.title);
  await reopened.getByRole("button", { name: "Delete" }).click();
  await confirmation.getByRole("button", { name: "Delete" }).click();

  // The confirmation names what left and where to get it back — asserted in one
  // wait, since it dismisses itself after a few seconds.
  await expect(
    page.locator("section[aria-label='Notifications']"),
    // `[\s\S]` rather than the `s` flag: tsconfig targets es5, where dotAll is
    // a compile error.
  ).toContainText(
    /Publication deleted[\s\S]*Restore it from Deleted publications/,
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expectPublicationCount(page, CORPUS_SIZE - 1);
  await expect(
    indexTable(page).getByRole("row").filter({ hasText: IRACEMA.title }),
  ).toHaveCount(0);

  // Search agrees: a control query still narrows to its author's works, while
  // the deleted record is gone from the search index too.
  const search = page.getByRole("textbox", { name: "Search publications" });
  await search.fill("Machado de Assis");
  await expect(
    indexTable(page).getByRole("row").filter({ hasText: "Dom Casmurro" }),
  ).toHaveCount(1);
  await search.fill("Iraçéma");
  await expect(
    indexTable(page).getByRole("row").filter({ hasText: IRACEMA.title }),
  ).toHaveCount(0);
  await search.clear();

  // The trash lists what is *currently* deleted — one entry, restorable with
  // one click.
  await page.goto("/admin/publications/deleted");
  const trashRow = page
    .getByRole("listitem")
    .filter({ hasText: IRACEMA.title });
  await expect(trashRow).toBeVisible();
  await expect(trashRow.getByText(/^Deleted /)).toBeVisible();
  await trashRow.getByRole("button", { name: "Restore" }).click();
  await expect(page.getByText("Publication restored")).toBeVisible();
  // Restored, so the trash is empty again — it tracks state, not events.
  await expect(
    page.getByText("no publication is currently deleted"),
  ).toBeVisible();

  await page.goto("/");
  await expectPublicationCount(page, CORPUS_SIZE);
  await expectPublicationRow(page, IRACEMA);

  // Delete it again — this tombstone stays in the trash while its twin is
  // re-imported below.
  const reopenedAgain = await openPublicationModal(page, IRACEMA.title);
  await reopenedAgain.getByRole("button", { name: "Delete" }).click();
  await confirmation.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expectPublicationCount(page, CORPUS_SIZE - 1);

  // The tombstone does not hold the composite key hostage: importing the very
  // same publication through the workspace succeeds.
  await page.goto("/admin/publications/new");
  await addPublicationRow(page, IRACEMA);
  await submitWorkspace(page, 1);

  await page.goto("/");
  await expectPublicationCount(page, CORPUS_SIZE);
  await expectPublicationRow(page, IRACEMA);

  // Restoring the stale tombstone fails gracefully: its twin now owns the
  // composite key, so the restore answers a conflict instead of crashing.
  await page.goto("/admin/publications/deleted");
  await page.getByRole("button", { name: "Restore" }).click();
  await expect(page.getByText(/imported again/)).toBeVisible();

  // The trash still lists it — the failed restore changed nothing — while the
  // feed keeps every event: two deletes and a restore, each attributed. The
  // two views answer different questions about the same record.
  await expect(
    page.getByRole("listitem").filter({ hasText: IRACEMA.title }),
  ).toHaveCount(1);

  await page.goto("/admin/publications/history");
  await expect(page.locator('li[data-action="restored"]')).toHaveCount(1);
  await expect(page.locator('li[data-action="deleted"]')).toHaveCount(2);
  await expect(page.getByText(`“${IRACEMA.title}”`).first()).toBeVisible();
  await expect(page.getByText("by dev-admin@localhost").first()).toBeVisible();
});

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
