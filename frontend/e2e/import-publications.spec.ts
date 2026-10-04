import { test, expect } from "./fixtures";
import {
  signInAsAdmin,
  seedCorpus,
  addPublicationRow,
  addRowSources,
  submitWorkspace,
  openPublicationModal,
  indexTable,
  expectPublicationCount,
  expectPublicationRow,
  PUBLICATIONS,
  CSV_HEADER,
  type PublicationInput,
  openDocument,
  uploadCsv,
} from "./helpers";

// One row under the header every fixture writes.
const CSV_ROW = `${CSV_HEADER}\nDom Casmurro (CSV),1899,BR,Noonday Press,Helen Caldwell,Dom Casmurro,Machado de Assis,A source\n`;

const [FIRST, SOURCED, DUPLICATED] = PUBLICATIONS;

const SOURCES = [
  "Caldwell, Helen. The Brazilian Othello of Machado de Assis, 1960.",
  "https://archive.org/details/domcasmurro0000mach",
];

test("an admin bulk-inserts publications with sources from the workspace", async ({
  page,
}) => {
  await signInAsAdmin(page);
  await openDocument(page);
  const table = indexTable(page);

  // Build up three publications in the grid before submitting anything.
  for (const publication of PUBLICATIONS) {
    await addPublicationRow(page, publication);
  }

  // Attach two sources to the second row through its "Sources" cell.
  await addRowSources(page, SOURCED.title, SOURCES);

  // Selection: a row is selected by its leading cell — the handle. The other
  // cells hold fields, and a click there belongs to the field.
  const handleOf = (title: string) =>
    table.getByRole("row", { name: title }).getByRole("cell").first();

  await handleOf(FIRST.title).click();
  await expect(page.getByRole("button", { name: "Deselect 1" })).toBeVisible();

  // Shift-click extends a contiguous range from it, and cmd-click then toggles
  // a single row back out.
  await handleOf(DUPLICATED.title).click({ modifiers: ["Shift"] });
  await expect(page.getByRole("button", { name: "Deselect 3" })).toBeVisible();

  await handleOf(SOURCED.title).click({ modifiers: ["Meta"] });
  await expect(page.getByRole("button", { name: "Deselect 2" })).toBeVisible();

  // Clicking anything that is not a row's handle clears it. The page heading
  // is the document's name, which `openDocument` sets to "E2E batch".
  await page.getByRole("heading", { name: "E2E batch", level: 1 }).click();
  await expect(page.getByRole("button", { name: /^Deselect/ })).toHaveCount(0);

  // Clicking into a field is not a selection: it is where you type.
  const titleCell = table
    .getByRole("row", { name: FIRST.title })
    .getByPlaceholder("Title", { exact: true });
  await titleCell.click();
  await expect(page.getByRole("button", { name: /^Deselect/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Submit" })).toBeVisible();

  // Duplicate the third row, then delete the copy again.
  const duplicatedRows = table.getByRole("row", { name: DUPLICATED.title });
  await handleOf(DUPLICATED.title).click();
  await expect(page.getByRole("button", { name: "Deselect 1" })).toBeVisible();
  await page.getByRole("button", { name: "Duplicate 1" }).click();
  await expect(duplicatedRows).toHaveCount(2);

  await duplicatedRows.nth(1).getByRole("cell").first().click();
  await page.getByRole("button", { name: "Discard 1" }).click();
  await expect(duplicatedRows).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Reset 1 discarded" }),
  ).toBeVisible();

  // One submit persists the whole batch.
  await submitWorkspace(page, PUBLICATIONS.length);

  // All three are in the index with their full content — every field of every
  // row round-tripped through the bulk insert — and the sources rode along.
  await page.goto("/");
  await expectPublicationCount(page, PUBLICATIONS.length);
  for (const publication of PUBLICATIONS) {
    await expectPublicationRow(page, publication);
  }
  const dialog = await openPublicationModal(page, SOURCED.title);
  for (const source of SOURCES) {
    await expect(dialog.getByText(source)).toBeVisible();
  }
  await page.keyboard.press("Escape");

  // The backfill wizard agrees: only the two unsourced publications queue up.
  await page.goto("/admin/publications/sources");
  const queue = page.getByRole("listbox", {
    name: "Publications missing sources",
  });
  await expect(queue.getByRole("option")).toHaveCount(PUBLICATIONS.length - 1);
  await expect(queue.getByRole("option", { name: SOURCED.title })).toHaveCount(
    0,
  );
});

const VALID: PublicationInput = {
  title: "The Posthumous Memoirs (E2E)",
  originalTitle: "Memórias Póstumas de Brás Cubas",
  year: "1997",
  authors: "Gregory Rabassa",
  originalAuthors: "Machado de Assis",
  country: "Brazil",
  publisher: "Oxford University Press",
};

// Missing its publisher — the server-side validation flags `required`.
const INCOMPLETE = { ...VALID, title: "Incomplete (E2E)" };

// An exact copy of a corpus row — the server-side validation flags `conflict`.
const DUPLICATE: PublicationInput = {
  title: "Dom Casmurro",
  originalTitle: "Dom Casmurro",
  year: "1953",
  authors: "Helen Caldwell",
  originalAuthors: "Machado de Assis",
  country: "United States",
  publisher: "Noonday Press",
};

test("an invalid row blocks submission until it is fixed", async ({ page }) => {
  await signInAsAdmin(page);
  await openDocument(page);
  const table = indexTable(page);

  // Commit a row without its publisher: it validates as invalid, the error
  // counter appears, and Submit stays disabled.
  await addPublicationRow(page, { ...INCOMPLETE, publisher: "" });
  await expect(page.getByLabel("1 invalid publication")).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit" })).toBeDisabled();

  // The counter opens the list of what is wrong, field by field, and leads back
  // to the row it is about.
  await page.getByLabel("1 invalid publication").click();
  const errors = page.getByRole("dialog", {
    name: "What is wrong with these rows",
  });
  await expect(errors).toContainText(
    "1 row cannot be inserted until it is corrected.",
  );
  await expect(errors).toContainText("Publishers");
  await errors.getByRole("button", { name: "Go to this row" }).click();
  await expect(errors).not.toBeVisible();

  // Filling the missing field revalidates the row and unblocks the submit.
  const row = table.getByRole("row", { name: /Incomplete \(E2E\)/ });
  const input = row.getByPlaceholder("Publishers", { exact: true });
  await input.click();
  await input.pressSequentially("Oxford University Press");
  await input.press("Enter");
  await page.keyboard.press("Tab");

  await expect(page.getByLabel("All publications are valid")).toBeVisible();
  await submitWorkspace(page, 1);
});

test("a duplicate of an existing publication is flagged as a conflict", async ({
  page,
}) => {
  await seedCorpus(page);
  await openDocument(page);
  const table = indexTable(page);

  // One genuinely new publication, then an exact duplicate of a stored one (last,
  // so its error tooltip doesn't hover over the draft row while it's being filled).
  await addPublicationRow(page, VALID);
  await addPublicationRow(page, DUPLICATE);

  // The duplicate is flagged against the database before anything is submitted.
  await expect(page.getByLabel("1 invalid publication")).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit" })).toBeDisabled();

  // Drop the conflicting row. Row-selection clicks must land on the signal cell
  // (field cells swallow them), and off its center — the centered error icon
  // opens a hover tooltip that would swallow the click instead.
  const duplicate = table.getByRole("row", { name: /Dom Casmurro/ });
  await duplicate
    .getByRole("cell")
    .first()
    .click({ position: { x: 4, y: 4 } });
  await page.getByRole("button", { name: "Discard 1" }).click();

  await expect(page.getByLabel("All publications are valid")).toBeVisible();
  await submitWorkspace(page, 1);
});

/**
 * A CSV whose rows the database would refuse for repeating something. The
 * first row names Knopf twice. The second names the United States by its code
 * and by its name. The third and fourth rows are the same publication. The
 * fifth row is in order.
 */
const REPEATS_CSV =
  [
    CSV_HEADER,
    `The Devil to Pay in the Backlands,1963,US,Knopf;Knopf,James L. Taylor;Harriet de Onís,Grande Sertão: Veredas,João Guimarães Rosa,`,
    `The Passion According to G.H.,1988,US;United States,University of Minnesota Press,Ronald W. Sousa,A Paixão Segundo G.H.,Clarice Lispector,`,
    `Epitaph of a Small Winner,1952,US,Noonday Press,William L. Grossman,Memórias Póstumas de Brás Cubas,Machado de Assis,`,
    `Epitaph of a Small Winner,1952,US,Noonday Press,William L. Grossman,Memórias Póstumas de Brás Cubas,Machado de Assis,`,
    `Macunaíma,1984,US,Random House,E. A. Goodland,Macunaíma,Mário de Andrade,`,
  ].join("\n") + "\n";

test("an import that repeats an entry or a whole row is held back until each repeat is gone", async ({
  page,
}) => {
  await seedCorpus(page);
  await openDocument(page, "Repeats");
  await uploadCsv(page, REPEATS_CSV, "repeats.csv");
  const table = indexTable(page);

  // Two rows name an entry twice, and the fourth repeats the third. All three
  // are refused before anything is submitted.
  const counter = page.getByLabel("3 invalid publications");
  await expect(counter).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Submit" })).toBeDisabled();

  await counter.click();
  const errors = page.getByRole("dialog", {
    name: "What is wrong with these rows",
  });
  const entries = errors.getByRole("listitem");
  await expect(entries).toHaveCount(3);
  await expect(entries.nth(0)).toContainText("Row 1");
  await expect(entries.nth(0)).toContainText("Publishers");
  await expect(entries.nth(0)).toContainText(
    "This field cannot repeat the same entry",
  );
  await expect(entries.nth(1)).toContainText("Row 2");
  await expect(entries.nth(1)).toContainText("Countries");
  await expect(entries.nth(2)).toContainText("Row 4");
  await expect(entries.nth(2)).toContainText(
    "Another row of this import is the same publication",
  );
  await page.keyboard.press("Escape");
  await expect(errors).not.toBeVisible();

  // Removing the second Knopf, and the country named a second time, leaves
  // each of those rows with its entries once.
  const devil = table.getByRole("row", { name: /The Devil to Pay/ });
  await devil.getByRole("button", { name: "Remove Knopf" }).last().click();
  const passion = table.getByRole("row", { name: /The Passion According/ });
  await passion
    .getByRole("button", { name: /^Remove United States/ })
    .last()
    .click();
  await expect(page.getByLabel("1 invalid publication")).toBeVisible({
    timeout: 30_000,
  });

  // The repeated row becomes a later printing of the same book, with a year of
  // its own, so it no longer repeats the row above it.
  const reprint = table
    .getByRole("row", { name: /Epitaph of a Small Winner/ })
    .nth(1);
  const year = reprint.getByPlaceholder("Year", { exact: true });
  await year.fill("1990");
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("All publications are valid")).toBeVisible({
    timeout: 30_000,
  });

  // A copy made with Duplicate repeats the row it was copied from, until it is
  // discarded. Row-selection clicks land on the signal cell, off its center.
  const select = (row: ReturnType<typeof table.getByRole>) =>
    row
      .getByRole("cell")
      .first()
      .click({ position: { x: 4, y: 4 } });

  await select(table.getByRole("row", { name: /Macunaíma/ }));
  await page.getByRole("button", { name: "Duplicate 1" }).click();
  await expect(page.getByLabel("1 invalid publication")).toBeVisible({
    timeout: 30_000,
  });

  const copies = table.getByRole("row", { name: /Macunaíma/ });
  await expect(copies).toHaveCount(2);
  await select(copies.nth(1));
  await page.getByRole("button", { name: "Discard 1" }).click();
  await expect(page.getByLabel("All publications are valid")).toBeVisible({
    timeout: 30_000,
  });

  // Both printings of Epitaph of a Small Winner are stored, next to the corpus.
  await submitWorkspace(page, 5);
  await page.goto("/");
  await expectPublicationCount(page, 12);
});

test("an admin imports publications from a CSV, sources included", async ({
  page,
}) => {
  await signInAsAdmin(page);
  await openDocument(page);

  await uploadCsv(page, CSV_ROW, "import.csv");

  // The imported row populates the workspace grid — its fields are editable
  // inputs, so match the row by accessible name — and the sources column
  // landed in the row's "Sources" cell.
  const row = indexTable(page).getByRole("row", {
    name: /Dom Casmurro \(CSV\)/,
  });
  await expect(row).toBeVisible();
  await expect(
    row.getByRole("button", { name: "Edit sources (1)" }),
  ).toBeVisible();
});

test("a malformed CSV is rejected with an error and imports nothing", async ({
  page,
}) => {
  await signInAsAdmin(page);
  await openDocument(page);

  // An unterminated quoted field — the csv parser rejects the whole file.
  await uploadCsv(
    page,
    `${CSV_HEADER}\nDom,1899,BR,P,T,O,"unterminated\n`,
    "broken.csv",
  );

  await expect(
    page.getByText("Could not parse publications from the provided file"),
  ).toBeVisible();
  // Nothing was imported — the grid still holds only its header and draft row.
  await expect(indexTable(page).getByRole("row")).toHaveCount(2);
});
