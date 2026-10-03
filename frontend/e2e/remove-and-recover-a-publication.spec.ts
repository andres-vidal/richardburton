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
  openDocument,
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
  ).toContainText(/Publication deleted.*Restore it from Deleted publications/s);
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
  await openDocument(page);
  await addPublicationRow(page, IRACEMA);
  await submitWorkspace(page, 1);

  await page.goto("/");
  await expectPublicationCount(page, CORPUS_SIZE);
  await expectPublicationRow(page, IRACEMA);

  // Restoring the stale tombstone is refused, since its twin now has the
  // composite key. A dialog shows the twin and offers to restore the tombstone
  // with changes, which it cannot be without.
  await page.goto("/admin/publications/deleted");
  const trashed = page.getByRole("listitem").filter({ hasText: IRACEMA.title });
  await trashed.getByRole("button", { name: "Restore" }).click();

  const offer = page.getByRole("dialog", {
    name: "Another publication is identical to this one",
  });
  await expect(offer).toBeVisible();
  await expect(
    offer.getByRole("link", { name: "Open this record" }),
  ).toBeVisible();
  const restoreChanged = offer.getByRole("button", {
    name: "Restore with these changes",
  });
  await expect(restoreChanged).toBeDisabled();

  // Closing the dialog changes nothing: the trash still lists the record.
  await page.keyboard.press("Escape");
  await expect(offer).toHaveCount(0);
  await expect(trashed).toHaveCount(1);

  // Given another year, the tombstone is a later printing, and the restore goes
  // through. The twin's card highlights the year it no longer shares.
  await trashed.getByRole("button", { name: "Restore" }).click();
  const year = offer.getByRole("textbox", { name: "Year" });
  await year.fill("1887");
  await year.blur();

  await expect(restoreChanged).toBeEnabled({ timeout: 15_000 });
  await expect(offer.locator("mark", { hasText: "1886" })).toBeVisible();

  await restoreChanged.click();
  await expect(page.getByText("Publication restored")).toBeVisible();
  await expect(
    page.getByText("no publication is currently deleted"),
  ).toBeVisible();

  // Both printings are in the database.
  await page.goto("/");
  await expectPublicationCount(page, CORPUS_SIZE + 1);
  const printings = indexTable(page)
    .getByRole("row")
    .filter({ hasText: IRACEMA.title });
  await expect(printings).toHaveCount(2);
  await expect(printings.filter({ hasText: "1886" })).toHaveCount(1);
  await expect(printings.filter({ hasText: "1887" })).toHaveCount(1);

  // The feed keeps every event, each attributed: two deletes, two restores,
  // and the edit the second restore was made with.
  await page.goto("/admin/publications/history");
  await expect(page.locator('li[data-action="restored"]')).toHaveCount(2);
  await expect(page.locator('li[data-action="deleted"]')).toHaveCount(2);
  await expect(page.locator('li[data-action="updated"]')).toHaveCount(1);
  await expect(page.getByText(`“${IRACEMA.title}”`).first()).toBeVisible();
  await expect(page.getByText("by dev-admin@localhost").first()).toBeVisible();
});
