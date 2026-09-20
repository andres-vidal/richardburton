import { test, expect } from "./fixtures";
import { seedCorpus, indexTable, CSV_HEADER } from "./helpers";

/**
 * A second import of the same material, entered by a different hand.
 *
 * The first row all but spells `Dom Casmurro`, which the corpus already holds —
 * a dropped letter in the title and in the translator's name, which is exactly
 * what the composite key lets through. The next two spell each other and are in
 * neither the corpus nor the database, so only a check within the import can
 * put them together. The last is its own work and must be left alone.
 */
const IMPORT_CSV =
  [
    CSV_HEADER,
    `Dom Casmuro,1953,US,Noonday Press,Helen Caldwel,Dom Casmurro,Machado de Assis,`,
    `The Devil to Pay in the Backlands,1963,US,Knopf,James L. Taylor,Grande Sertão: Veredas,João Guimarães Rosa,`,
    `The Devil to Pay in the Backland,1963,GB,Knopf,James L Taylor,Grande Sertao Veredas,João Guimarães Rosa,`,
    `The Passion According to G.H.,1988,US,Minnesota,Ronald Sousa,A Paixão Segundo G.H.,Clarice Lispector,`,
  ].join("\n") + "\n";

test("an admin catches look-alikes before importing them", async ({ page }) => {
  await seedCorpus(page);

  await page.goto("/admin/publications/new");
  await page.locator("#upload-csv").setInputFiles({
    name: "second-pass.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(IMPORT_CSV),
  });

  const table = indexTable(page);
  await expect(table.getByRole("row", { name: /Dom Casmuro/ })).toBeVisible();

  // Nothing is claimed before the check is run: the button offers to run it.
  const check = page.getByRole("button", { name: "Check for duplicates" });
  await expect(check).toBeVisible();
  await check.click();

  // Three of the four rows are raised — one against the database, two against
  // each other — and the fourth, its own work, is not.
  const found = page.getByRole("button", {
    name: "3 rows look like publications already known",
  });
  await expect(found).toBeVisible({ timeout: 30_000 });

  await found.click();
  const review = page.getByRole("dialog", {
    name: "Possible duplicates in this import",
  });
  await expect(review).toBeVisible();

  // The first question is the row against the record the corpus already holds.
  await expect(
    review.getByText("Resembles one record already in the database."),
  ).toBeVisible();
  await expect(
    review.getByRole("heading", { name: "Already in the database" }),
  ).toBeVisible();
  await expect(review.getByText("1 / 3")).toBeVisible();

  // It is the same publication, so the row goes.
  await review.getByRole("button", { name: "Discard this row" }).click();

  // The next question is the pair that only exists inside this import.
  await expect(review.getByText("2 / 3")).toBeVisible();
  await expect(
    review.getByText("Resembles one other row of this import."),
  ).toBeVisible();
  await expect(
    review.getByRole("heading", { name: "Elsewhere in this import" }),
  ).toBeVisible();

  // They are two records of one edition, so one of them goes too.
  await review.getByRole("button", { name: "Discard this row" }).click();

  // The last question is its pair, now answered by the discard: keep it.
  await expect(review.getByText("3 / 3")).toBeVisible();
  await review
    .getByRole("button", { name: "Keep it — they are different" })
    .click();

  await expect(review.getByText("Every look-alike answered")).toBeVisible();
  await review.getByRole("button", { name: "Done" }).click();
  await expect(review).not.toBeVisible();

  // Both discarded rows left the working set; the work of its own never asked.
  await expect(table.getByRole("row", { name: /Dom Casmuro/ })).toHaveCount(0);
  await expect(
    table.getByRole("row", { name: /The Devil to Pay in the Backlands/ }),
  ).toHaveCount(0);
  // Only the surviving one of the pair still matches the shorter title.
  await expect(
    table.getByRole("row", { name: /The Devil to Pay in the Backland/ }),
  ).toHaveCount(1);
  await expect(
    table.getByRole("row", { name: /The Passion According to G\.H\./ }),
  ).toBeVisible();
});
