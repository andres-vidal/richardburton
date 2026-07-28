import { test, expect } from "./fixtures";
import {
  signInAsAdmin,
  seedCorpus,
  addPublicationRow,
  addRowReferences,
  submitWorkspace,
  openPublicationModal,
  indexTable,
  expectPublicationCount,
  expectPublicationRow,
  PUBLICATIONS,
  type PublicationInput,
} from "./helpers";

// One row, 8 semicolon-separated columns in codec order:
// original_authors; year; countries; original_title; title; authors; publishers; references
const CSV_ROW =
  "Machado de Assis;1899;BR;Dom Casmurro;Dom Casmurro (CSV);Helen Caldwell;Noonday Press;A source\n";

const [FIRST, REFERENCED, DUPLICATED] = PUBLICATIONS;

const REFERENCES = [
  "Caldwell, Helen. The Brazilian Othello of Machado de Assis, 1960.",
  "https://archive.org/details/domcasmurro0000mach",
];

test("an admin bulk-inserts publications with references from the workspace", async ({
  page,
}) => {
  await signInAsAdmin(page);
  await page.goto("/admin/publications/new");
  const table = indexTable(page);

  // Build up three publications in the grid before submitting anything.
  for (const publication of PUBLICATIONS) {
    await addPublicationRow(page, publication);
  }

  // Attach two sources to the second row through its "Sources" cell.
  await addRowReferences(page, REFERENCED.title, REFERENCES);

  // Selection: a row is selected by its leading cell — the handle. The other
  // cells hold fields, and a click there belongs to the field.
  const handleOf = (title: string) =>
    table.getByRole("row", { name: title }).getByRole("cell").first();

  await handleOf(FIRST.title).click();
  await expect(page.getByRole("button", { name: "Deselect 1" })).toBeVisible();

  // Shift-click extends a contiguous range from it, and cmd-click then toggles a
  // single row back out. Both used to lose the selection instead of changing it.
  await handleOf(DUPLICATED.title).click({ modifiers: ["Shift"] });
  await expect(page.getByRole("button", { name: "Deselect 3" })).toBeVisible();

  await handleOf(REFERENCED.title).click({ modifiers: ["Meta"] });
  await expect(page.getByRole("button", { name: "Deselect 2" })).toBeVisible();

  // Clicking anything that is not a row's handle clears it.
  await page.getByRole("heading", { name: "Add publications" }).click();
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
  // row round-tripped through the bulk insert — and the references rode along.
  await page.goto("/");
  await expectPublicationCount(page, PUBLICATIONS.length);
  for (const publication of PUBLICATIONS) {
    await expectPublicationRow(page, publication);
  }
  const dialog = await openPublicationModal(page, REFERENCED.title);
  for (const reference of REFERENCES) {
    await expect(dialog.getByText(reference)).toBeVisible();
  }
  await page.keyboard.press("Escape");

  // The backfill wizard agrees: only the two unreferenced publications queue up.
  await page.goto("/admin/publications/references");
  const queue = page.getByRole("listbox", {
    name: "Publications missing references",
  });
  await expect(queue.getByRole("option")).toHaveCount(PUBLICATIONS.length - 1);
  await expect(
    queue.getByRole("option", { name: REFERENCED.title }),
  ).toHaveCount(0);
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
  await page.goto("/admin/publications/new");
  const table = indexTable(page);

  // Commit a row without its publisher: it validates as invalid, the error
  // counter appears, and Submit stays disabled.
  await addPublicationRow(page, { ...INCOMPLETE, publisher: "" });
  await expect(page.getByLabel("1 invalid publications")).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit" })).toBeDisabled();

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
  await page.goto("/admin/publications/new");
  const table = indexTable(page);

  // One genuinely new publication, then an exact duplicate of a stored one (last,
  // so its error tooltip doesn't hover over the draft row while it's being filled).
  await addPublicationRow(page, VALID);
  await addPublicationRow(page, DUPLICATE);

  // The duplicate is flagged against the database before anything is submitted.
  await expect(page.getByLabel("1 invalid publications")).toBeVisible();
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

test("an admin imports publications from a CSV, references included", async ({
  page,
}) => {
  await signInAsAdmin(page);
  await page.goto("/admin/publications/new");

  await page.locator("#upload-csv").setInputFiles({
    name: "import.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(CSV_ROW),
  });

  // The imported row populates the workspace grid — its fields are editable
  // inputs, so match the row by accessible name — and the references column
  // landed in the row's "Sources" cell.
  const row = indexTable(page).getByRole("row", {
    name: /Dom Casmurro \(CSV\)/,
  });
  await expect(row).toBeVisible();
  await expect(
    row.getByRole("button", { name: "Edit references (1)" }),
  ).toBeVisible();
});

test("a malformed CSV is rejected with an error and imports nothing", async ({
  page,
}) => {
  await signInAsAdmin(page);
  await page.goto("/admin/publications/new");

  // An unterminated quoted field — the csv parser rejects the whole file.
  await page.locator("#upload-csv").setInputFiles({
    name: "broken.csv",
    mimeType: "text/csv",
    buffer: Buffer.from('Machado de Assis;1899;BR;Dom;"unterminated\n'),
  });

  await expect(
    page.getByText("Could not parse publications from the provided file"),
  ).toBeVisible();
  // Nothing was imported — the grid still holds only its header and draft row.
  await expect(indexTable(page).getByRole("row")).toHaveCount(2);
});
