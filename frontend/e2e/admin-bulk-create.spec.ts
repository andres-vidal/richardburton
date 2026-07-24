import { test, expect } from "./fixtures";
import {
  signInAsAdmin,
  addPublicationRow,
  addRowReferences,
  submitWorkspace,
  openPublicationModal,
  indexTable,
  expectPublicationCount,
  expectPublicationRow,
  PUBLICATIONS,
} from "./helpers";

const [, REFERENCED, DUPLICATED] = PUBLICATIONS;

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

  // Selection tools: select the third row (via its signal cell — the row's cells
  // are inputs), duplicate it, then delete the copy again.
  const duplicatedRows = table.getByRole("row", { name: DUPLICATED.title });
  await duplicatedRows.getByRole("cell").first().click();
  await expect(page.getByRole("button", { name: "Deselect 1" })).toBeVisible();
  await page.getByRole("button", { name: "Duplicate 1" }).click();
  await expect(duplicatedRows).toHaveCount(2);

  await duplicatedRows.nth(1).getByRole("cell").first().click();
  await page.getByRole("button", { name: "Delete 1" }).click();
  await expect(duplicatedRows).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Reset 1 deleted" }),
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
