import { test, expect } from "./fixtures";
import {
  seedCorpus,
  indexTable,
  draftRow,
  commitMulti,
  selectEnumOption,
  CSV_HEADER,
} from "./helpers";

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

test("a row keeps its look-alike while the rest of it is filled in", async ({
  page,
}) => {
  await seedCorpus(page);
  await page.goto("/admin/publications/new");

  // Only what a look-alike is measured on: the title and the names. The rest of
  // the row comes after, which is the point of the test.
  const draft = draftRow(page);
  await draft.getByPlaceholder("Title", { exact: true }).fill("Dom Casmuro");
  await draft
    .getByPlaceholder("Original Title", { exact: true })
    .fill("Dom Casmurro");
  await commitMulti(draft, "Translators", "Helen Caldwell");
  await commitMulti(draft, "Original Authors", "Machado de Assis");
  await draft.getByRole("button", { name: "Add publication" }).click();

  const row = indexTable(page).getByRole("row", { name: /Dom Casmuro/ });
  const marked = row.getByRole("button", { name: /^Resembles / });
  await expect(marked).toBeVisible({ timeout: 30_000 });

  // Filling the rest changes nothing about what the row resembles, so the
  // answer has to survive it: a field that made the answer stale without asking
  // again would drop it for good.
  await row.getByPlaceholder("Year", { exact: true }).fill("1953");
  await page.keyboard.press("Tab");
  await expect(marked).toBeVisible();

  await selectEnumOption(row, "Countries", "United States");
  await expect(marked).toBeVisible();

  await commitMulti(row, "Publishers", "Noonday Press");
  await page.keyboard.press("Tab");

  // The row is valid now, and still says what it looks like — in the leading
  // cell, where a marked row is spotted, as well as at its end.
  await expect(page.getByLabel("All publications are valid")).toBeVisible();
  await expect(marked).toBeVisible();
  await expect(
    row.getByRole("img", {
      name: "This row looks like a publication already known",
    }),
  ).toBeVisible();
});

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

  // The rows are measured as they arrive, so nothing has to be pressed. Three
  // of the four are raised — one against the database, two against each other —
  // and the fourth, its own work, is not.
  const found = page.getByRole("button", {
    name: "3 rows look like publications already known",
  });
  await expect(found).toBeVisible({ timeout: 30_000 });

  // A row says what it looks like, rather than only that it looks like
  // something. The one that resembles the corpus names the record by title and
  // year; the one that resembles its neighbour says so.
  // The row is marked where its status is — beside where an error would be —
  // and says what it resembles at the end, where something can be done about it.
  const casmuro = table.getByRole("row", { name: /Dom Casmuro/ });
  await expect(
    casmuro.getByRole("img", {
      name: "This row looks like a publication already known",
    }),
  ).toBeVisible();
  await expect(
    casmuro.getByRole("button", { name: "Resembles Dom Casmurro (1953)." }),
  ).toBeVisible();

  // A marked row is still a row: the marker shares the leading cell with the
  // error icon, and that cell is what selects.
  await casmuro.getByRole("cell").first().click();
  await expect(page.getByRole("button", { name: "Deselect 1" })).toBeVisible();
  await page.getByRole("button", { name: "Deselect 1" }).click();

  // Pressing a row's warning opens the review on that row, not at the top of
  // the queue — and selecting the row still works, since the control inside the
  // handle takes only its own clicks.
  const marked = table
    .getByRole("row", { name: /The Devil to Pay in the Backlands/ })
    .getByRole("button", { name: "Resembles one other row of this import." });
  await marked.click();

  await expect(
    page.getByRole("dialog", { name: "Possible duplicates in this import" }),
  ).toBeVisible();
  await expect(page.getByText("2 / 3")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Possible duplicates in this import" }),
  ).not.toBeVisible();

  await found.click();
  const review = page.getByRole("dialog", {
    name: "Possible duplicates in this import",
  });
  await expect(review).toBeVisible();

  // The stored record can be followed through to, in a tab of its own so the
  // rows waiting here are not lost.
  await expect(
    review.getByRole("link", { name: "Open this record" }),
  ).toHaveAttribute("target", "_blank");

  // The first is the row against the record the corpus already holds.
  await expect(
    review.getByText("Resembles one record already in the database."),
  ).toBeVisible();
  await expect(
    review.getByRole("heading", { name: "Already in the database" }),
  ).toBeVisible();
  await expect(review.getByText("1 / 3")).toBeVisible();

  // The review reads, it does not decide: it steps through what was found, both
  // ways, and stops at the ends.
  await expect(review.getByRole("button", { name: "Previous" })).toBeDisabled();
  await review.getByRole("button", { name: "Next" }).click();

  await expect(review.getByText("2 / 3")).toBeVisible();
  await expect(
    review.getByText("Resembles one other row of this import."),
  ).toBeVisible();
  await expect(
    review.getByRole("heading", { name: "Elsewhere in this import" }),
  ).toBeVisible();

  await review.getByRole("button", { name: "Next" }).click();
  await expect(review.getByText("3 / 3")).toBeVisible();
  await expect(review.getByRole("button", { name: "Next" })).toBeDisabled();

  await review.getByRole("button", { name: "Previous" }).click();
  await expect(review.getByText("2 / 3")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(review).not.toBeVisible();

  // Having read it, the rows are dealt with in the workspace itself — selected
  // by their handles and discarded, the way any other row would be.
  await table
    .getByRole("row", { name: /Dom Casmuro/ })
    .getByRole("cell")
    .first()
    .click();
  await table
    .getByRole("row", { name: /The Devil to Pay in the Backlands/ })
    .getByRole("cell")
    .first()
    .click({ modifiers: ["Meta"] });
  await expect(page.getByRole("button", { name: "Deselect 2" })).toBeVisible();
  await page.getByRole("button", { name: /^Discard/ }).click();

  // Both left the working set; the work of its own never asked.
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

  // And nothing is left looking like anything, so the count goes.
  await expect(page.getByRole("button", { name: /rows? look/ })).toHaveCount(0);
});
