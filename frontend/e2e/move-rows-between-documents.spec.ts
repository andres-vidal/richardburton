import { test, expect } from "./fixtures";
import {
  CORPUS_SIZE,
  CSV_HEADER,
  IMPORT_CSV,
  expectPublicationCount,
  indexTable,
  moveSelectedRows,
  openDocument,
  seedCorpus,
  signInAsAdmin,
  signInAsContributor,
  submitWorkspace,
  uploadCsv,
} from "./helpers";

/**
 * A batch of four rows. The first and fourth are new publications. The second
 * repeats the corpus's `Dom Casmurro`, so the database would refuse it. The
 * third has no publisher.
 */
const BATCH_CSV =
  [
    CSV_HEADER,
    `The Devil to Pay in the Backlands,1963,US,Knopf,James L. Taylor,Grande Sertão: Veredas,João Guimarães Rosa,`,
    `Dom Casmurro,1953,US,Noonday Press,Helen Caldwell,Dom Casmurro,Machado de Assis,`,
    `Macunaíma,1984,US,,E. A. Goodland,Macunaíma,Mário de Andrade,`,
    `The Passion According to G.H.,1988,US,University of Minnesota Press,Ronald W. Sousa,A Paixão Segundo G.H.,Clarice Lispector,`,
  ].join("\n") + "\n";

test("rows that are not ready are set aside in a new document, and the rest of the batch is imported", async ({
  page,
}) => {
  await seedCorpus(page);
  await openDocument(page, "Batch");
  await uploadCsv(page, BATCH_CSV, "batch.csv");
  const table = indexTable(page);

  // Two of the four rows hold the batch back.
  await expect(page.getByLabel("2 invalid publications")).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole("button", { name: "Submit" })).toBeDisabled();

  // Select both, by their leading cells and off their centers, where the error
  // icon opens a tooltip.
  await table
    .getByRole("row", { name: /Dom Casmurro/ })
    .getByRole("cell")
    .first()
    .click({ position: { x: 4, y: 4 } });
  await table
    .getByRole("row", { name: /Macunaíma/ })
    .getByRole("cell")
    .first()
    .click({ position: { x: 4, y: 4 }, modifiers: ["Meta"] });
  await expect(page.getByRole("button", { name: "Deselect 2" })).toBeVisible();

  // Move them to a new document, and open it in a new tab from the dialog that
  // says where they went.
  await page.getByRole("button", { name: "Move 2" }).click();
  const dialog = page.getByRole("dialog", {
    name: "Move 2 rows to another document",
  });
  await dialog
    .getByRole("textbox", { name: "Name of the new document" })
    .fill("Set aside");
  await dialog.getByRole("button", { name: "Move 2 rows" }).click();

  const moved = page.getByRole("dialog", { name: "Moved 2 rows" });
  await expect(moved).toContainText("They are now at the end of “Set aside”.", {
    timeout: 30_000,
  });

  const [tab] = await Promise.all([
    page.waitForEvent("popup"),
    moved.getByRole("link", { name: "Open “Set aside” in a new tab" }).click(),
  ]);
  await expect(
    indexTable(tab).getByRole("row", { name: /Dom Casmurro/ }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(
    indexTable(tab).getByRole("row", { name: /Macunaíma/ }),
  ).toBeVisible();
  await tab.close();

  await moved.getByRole("button", { name: "Done" }).click();
  await expect(moved).not.toBeVisible();

  // They leave the batch, which is now valid and imports on its own.
  await expect(table.getByRole("row", { name: /Dom Casmurro/ })).toHaveCount(0);
  await expect(table.getByRole("row", { name: /Macunaíma/ })).toHaveCount(0);
  await expect(page.getByLabel("All publications are valid")).toBeVisible({
    timeout: 30_000,
  });
  await submitWorkspace(page, 2);

  await page.goto("/");
  await expectPublicationCount(page, CORPUS_SIZE + 2);

  // The new document holds the two rows, with what is wrong with each.
  await page.goto("/admin/publications/documents");
  await expect(
    page
      .getByRole("list", { name: "Import documents" })
      .getByRole("listitem")
      .filter({ hasText: "Set aside" }),
  ).toContainText("2 rows");
  await page.getByRole("link", { name: "Open Set aside" }).click();

  const aside = indexTable(page);
  await expect(aside.getByRole("row", { name: /Dom Casmurro/ })).toBeVisible();
  await expect(aside.getByRole("row", { name: /Macunaíma/ })).toBeVisible();
  await expect(page.getByLabel("2 invalid publications")).toBeVisible({
    timeout: 30_000,
  });
});

test("rows moved into a document a colleague has open appear for the colleague", async ({
  page,
  colleague,
}) => {
  await signInAsAdmin(page);
  await openDocument(page, "Batch");
  await uploadCsv(page, IMPORT_CSV, "batch.csv");
  await expect(page.getByRole("status", { name: "Saved" })).toBeVisible();

  // The colleague starts a document of their own and keeps it open.
  await signInAsContributor(colleague);
  await openDocument(colleague, "Held back");
  const theirs = indexTable(colleague);
  await expect(theirs.getByRole("row", { name: /Iracema/ })).toHaveCount(0);

  // Iracema moves from the batch into the colleague's document.
  await indexTable(page)
    .getByRole("row", { name: /Iracema/ })
    .getByRole("cell")
    .first()
    .click();
  await moveSelectedRows(page, 1, { existing: "Held back" });

  await expect(
    indexTable(page).getByRole("row", { name: /Iracema/ }),
  ).toHaveCount(0);
  await expect(
    indexTable(page).getByRole("row", { name: /Dom Casmurro/ }),
  ).toBeVisible();

  // It appears for the colleague without a reload, and stays after one.
  await expect(theirs.getByRole("row", { name: /Iracema/ })).toBeVisible({
    timeout: 30_000,
  });
  await colleague.reload();
  await expect(
    indexTable(colleague).getByRole("row", { name: /Iracema/ }),
  ).toBeVisible();
});
