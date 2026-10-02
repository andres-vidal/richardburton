import { test, expect } from "./fixtures";
import {
  seedCorpus,
  indexTable,
  draftRow,
  commitMulti,
  selectEnumOption,
  CSV_HEADER,
  openDocument,
  uploadCsv,
} from "./helpers";

/**
 * A CSV with five rows.
 *
 * The first row is the corpus's `Dom Casmurro` with one letter missing from the
 * title and one from the translator's name. The composite key does not catch
 * this. The second and third rows are near-copies of each other and are not in
 * the database, so only the comparison between the import's rows finds them.
 * The fourth row resembles nothing. The fifth row is a later printing of the
 * corpus's `Dom Casmurro`, with its own year and publisher, so it resembles
 * nothing either.
 */
const IMPORT_CSV =
  [
    CSV_HEADER,
    `Dom Casmuro,1953,US,Noonday Press,Helen Caldwel,Dom Casmurro,Machado de Assis,`,
    `The Devil to Pay in the Backlands,1963,US,Knopf,James L. Taylor,Grande Sertão: Veredas,João Guimarães Rosa,`,
    `The Devil to Pay in the Backland,1963,US,Knopf,James L Taylor,Grande Sertao Veredas,João Guimarães Rosa,`,
    `The Passion According to G.H.,1988,US,Minnesota,Ronald Sousa,A Paixão Segundo G.H.,Clarice Lispector,`,
    `Dom Casmurro,1966,US,University of California Press,Helen Caldwell,Dom Casmurro,Machado de Assis,`,
  ].join("\n") + "\n";

test("a row keeps its look-alike while the rest of it is filled in", async ({
  page,
}) => {
  await seedCorpus(page);
  await openDocument(page);

  // Fill only the title, original title, translators and original authors. The
  // year, countries and publishers are filled after the row is marked.
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

  // An empty year, country or publisher does not rule out a look-alike, and
  // the values filled here agree with the stored record, so the row stays
  // marked after each one.
  await row.getByPlaceholder("Year", { exact: true }).fill("1953");
  await page.keyboard.press("Tab");
  await expect(marked).toBeVisible();

  await selectEnumOption(row, "Countries", "United States");
  await expect(marked).toBeVisible();

  await commitMulti(row, "Publishers", "Noonday Press");
  await page.keyboard.press("Tab");

  // The row is now valid. It still has the look-alike button at its end and
  // the warning icon in its leading cell.
  await expect(page.getByLabel("All publications are valid")).toBeVisible();
  await expect(marked).toBeVisible();
  await expect(
    row.getByRole("img", {
      name: "This row looks like a publication already known",
    }),
  ).toBeVisible();

  // Another year makes the row another printing of the stored record, so the
  // row is no longer marked.
  await row.getByPlaceholder("Year", { exact: true }).fill("1966");
  await page.keyboard.press("Tab");
  await expect(marked).toHaveCount(0);
});

test("an admin catches look-alikes before importing them", async ({ page }) => {
  await seedCorpus(page);

  await openDocument(page);
  await uploadCsv(page, IMPORT_CSV, "second-pass.csv");

  const table = indexTable(page);
  await expect(table.getByRole("row", { name: /Dom Casmuro/ })).toBeVisible();

  // The check runs after the upload without any button press. Three of the
  // five rows resemble something: the first resembles a stored record, and the
  // second and third resemble each other. The fourth and fifth resemble
  // nothing.
  const found = page.getByRole("button", {
    name: "3 rows look like publications already known",
  });
  await expect(found).toBeVisible({ timeout: 30_000 });

  // The later printing shares its title and translator with the stored
  // `Dom Casmurro`, but not its year or publisher, so it has no look-alike
  // button.
  await expect(
    table
      .getByRole("row", { name: /University of California Press/ })
      .getByRole("button", { name: /^Resembles / }),
  ).toHaveCount(0);

  // The row that resembles a stored record has the warning icon in its leading
  // cell, where an error icon would be. Its look-alike button, at the end of
  // the row, names the record by title and year.
  const casmuro = table.getByRole("row", { name: /Dom Casmuro/ });
  await expect(
    casmuro.getByRole("img", {
      name: "This row looks like a publication already known",
    }),
  ).toBeVisible();
  await expect(
    casmuro.getByRole("button", { name: "Resembles Dom Casmurro (1953)." }),
  ).toBeVisible();

  // Clicking the leading cell of a marked row still selects the row.
  await casmuro.getByRole("cell").first().click();
  await expect(page.getByRole("button", { name: "Deselect 1" })).toBeVisible();
  await page.getByRole("button", { name: "Deselect 1" }).click();

  // Clicking a row's look-alike button opens the review on that row, which is
  // second in the queue, not on the first row.
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

  // The stored record links to its own page, which opens in a new tab.
  await expect(
    review.getByRole("link", { name: "Open this record" }),
  ).toHaveAttribute("target", "_blank");

  // The first row in the queue resembles the stored `Dom Casmurro`.
  await expect(
    review.getByText("Resembles one record already in the database."),
  ).toBeVisible();
  await expect(
    review.getByRole("heading", { name: "Already in the database" }),
  ).toBeVisible();
  await expect(review.getByText("1 / 3")).toBeVisible();

  // Each card highlights the text it has that the other lacks: the letter
  // missing from the title and the one missing from the translator's name.
  const marks = review.locator("mark");
  await expect(marks).toHaveText([
    "Casmuro",
    "Caldwel",
    "Casmurro",
    "Caldwell",
  ]);

  // Next and Previous move through the queue and are disabled at its ends.
  await expect(review.getByRole("button", { name: "Previous" })).toBeDisabled();
  await review.getByRole("button", { name: "Next" }).click();

  await expect(review.getByText("2 / 3")).toBeVisible();
  await expect(
    review.getByText("Resembles one other row of this import."),
  ).toBeVisible();
  await expect(
    review.getByRole("heading", { name: "Elsewhere in this import" }),
  ).toBeVisible();

  // The two rows of the import differ in the title's last letter, the
  // translator's initial and the accent in the original title.
  await expect(marks).toHaveText([
    "Backlands",
    "L.",
    "Sertão:",
    "Backland",
    "L",
    "Sertao",
  ]);

  await review.getByRole("button", { name: "Next" }).click();
  await expect(review.getByText("3 / 3")).toBeVisible();
  await expect(review.getByRole("button", { name: "Next" })).toBeDisabled();

  await review.getByRole("button", { name: "Previous" }).click();
  await expect(review.getByText("2 / 3")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(review).not.toBeVisible();

  // Discard the first and second rows in the workspace, by selecting them with
  // their leading cells and pressing Discard.
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

  // Both rows are gone from the working set, and the other three are still
  // there.
  await expect(table.getByRole("row", { name: /Dom Casmuro/ })).toHaveCount(0);
  await expect(
    table.getByRole("row", { name: /The Devil to Pay in the Backlands/ }),
  ).toHaveCount(0);
  // This pattern also matches the discarded second row's title, so a count of
  // one means only the third row is left.
  await expect(
    table.getByRole("row", { name: /The Devil to Pay in the Backland/ }),
  ).toHaveCount(1);
  await expect(
    table.getByRole("row", { name: /The Passion According to G\.H\./ }),
  ).toBeVisible();
  await expect(
    table.getByRole("row", { name: /University of California Press/ }),
  ).toBeVisible();

  // Discarding changes the visible rows, so the check runs again. The third
  // row's only match was the second row, so no row resembles anything and the
  // counter is gone.
  await expect(page.getByRole("button", { name: /rows? look/ })).toHaveCount(0);
});
