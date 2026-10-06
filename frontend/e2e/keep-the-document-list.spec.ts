import { test, expect } from "./fixtures";
import {
  signInAsAdmin,
  signInAsContributor,
  indexTable,
  openDocument,
  uploadCsv,
  CSV_HEADER,
  IMPORT_CSV,
} from "./helpers";

/**
 * The entries of the "Import documents" list. The list is found by its name,
 * because the breadcrumb on the same page is also a list.
 */
const documents = (page: import("@playwright/test").Page) =>
  page.getByRole("list", { name: "Import documents" }).getByRole("listitem");

test("a document is renamed in place, and the list keeps the new name", async ({
  page,
}) => {
  await signInAsAdmin(page);
  await openDocument(page, "Second pass");

  await page.goto("/admin/publications/documents");

  const entry = documents(page).filter({ hasText: "Second pass" });
  await entry.getByRole("button", { name: "Rename" }).click();

  const field = page.getByLabel("Name of Second pass");
  await field.fill("The 1970s");
  await field.press("Enter");

  await expect(documents(page).filter({ hasText: "The 1970s" })).toBeVisible();

  // Renaming changes the existing document. It does not add a second one.
  await expect(documents(page)).toHaveCount(1);

  // The new name is still there after a reload, so the server saved it.
  await page.reload();
  await expect(documents(page).filter({ hasText: "The 1970s" })).toBeVisible();
});

test("a rename thought better of leaves the name alone", async ({ page }) => {
  await signInAsAdmin(page);
  await openDocument(page, "Second pass");

  await page.goto("/admin/publications/documents");

  const entry = documents(page).filter({ hasText: "Second pass" });
  await entry.getByRole("button", { name: "Rename" }).click();

  const field = page.getByLabel("Name of Second pass");
  await field.fill("Something else");
  await field.press("Escape");

  await expect(
    documents(page).filter({ hasText: "Second pass" }),
  ).toBeVisible();
});

test("an archived document leaves the list, keeps its rows, and can be put back", async ({
  page,
}) => {
  await signInAsAdmin(page);
  await openDocument(page, "Abandoned sweep");

  // Give the document rows, to check that archiving keeps them.
  await uploadCsv(page, IMPORT_CSV, "import.csv");
  await expect(
    indexTable(page).getByRole("row", { name: /Dom Casmurro/ }),
  ).toBeVisible();

  // The row count in the list is saved with each update to the server, so wait
  // for Saved before reading the list.
  await expect(page.getByRole("status", { name: "Saved" })).toBeVisible();

  await page.goto("/admin/publications/documents");

  const entry = documents(page).filter({ hasText: "Abandoned sweep" });
  await expect(entry).toContainText("2 rows");
  await entry.getByRole("button", { name: "Archive" }).click();

  // The document leaves the list, and the list shows its empty message.
  await expect(page.getByText("No documents yet")).toBeVisible();

  // The Archived list shows the document with its 2 rows and no Archive button.
  await page.getByRole("button", { name: "Archived" }).click();

  const archived = page
    .getByRole("list", { name: "Archived" })
    .getByRole("listitem")
    .filter({ hasText: "Abandoned sweep" });

  await expect(archived).toContainText("2 rows");
  await expect(archived.getByRole("button", { name: "Archive" })).toHaveCount(
    0,
  );

  await archived.getByRole("button", { name: "Put it back" }).click();

  await page.getByRole("button", { name: "On the list" }).click();
  await expect(
    documents(page).filter({ hasText: "Abandoned sweep" }),
  ).toBeVisible();

  // The restored document still has its rows.
  await documents(page)
    .filter({ hasText: "Abandoned sweep" })
    .getByRole("link")
    .click();

  await expect(
    indexTable(page).getByRole("row", { name: /Dom Casmurro/ }),
  ).toBeVisible();
});

/**
 * A second batch: two new publications, and a repeat of IMPORT_CSV's Dom
 * Casmurro, which the document already holds.
 */
const SECOND_BATCH_CSV =
  [
    CSV_HEADER,
    `Macunaíma,1984,US,Random House,E. A. Goodland,Macunaíma,Mário de Andrade,`,
    `Dom Casmurro,1953,US,Noonday Press,Helen Caldwell,Dom Casmurro,Machado de Assis,`,
    `The Hour of the Star,1986,US,Carcanet,Giovanni Pontiero,A Hora da Estrela,Clarice Lispector,`,
  ].join("\n") + "\n";

test("a second upload adds its rows after the ones already there, and Undo takes them out again", async ({
  page,
}) => {
  await signInAsAdmin(page);
  await openDocument(page, "Second pass");
  const table = indexTable(page);
  const titles = () =>
    table.getByRole("textbox", { name: "Title" }).evaluateAll((inputs) =>
      inputs
        .map((input) => (input as HTMLInputElement).value)
        // The empty line at the foot of the table, for a new row.
        .filter(Boolean),
    );

  await uploadCsv(page, IMPORT_CSV, "first.csv");
  await expect(table.getByRole("row", { name: /Iracema/ })).toBeVisible();

  // The second file's rows follow the first file's, which are all kept.
  await uploadCsv(page, SECOND_BATCH_CSV, "second.csv");
  await expect(table.getByRole("row", { name: /Macunaíma/ })).toBeVisible();
  await expect
    .poll(titles)
    .toEqual([
      "Dom Casmurro",
      "Iracema",
      "Macunaíma",
      "Dom Casmurro",
      "The Hour of the Star",
    ]);

  // The repeated Dom Casmurro is caught across the two uploads, so Submit
  // waits until it is dealt with.
  await expect(page.getByLabel("1 invalid publication")).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole("button", { name: "Submit" })).toBeDisabled();

  // One Undo takes the whole second upload out, and the first file's rows stay.
  await page.getByRole("button", { name: "Undo" }).click();
  await expect.poll(titles).toEqual(["Dom Casmurro", "Iracema"]);
  await expect(page.getByLabel("1 invalid publication")).toHaveCount(0);

  // The same file can be chosen again.
  await uploadCsv(page, SECOND_BATCH_CSV, "second.csv");
  await expect(
    table.getByRole("row", { name: /The Hour of the Star/ }),
  ).toBeVisible();
});

test("a document says its work has been saved", async ({ page }) => {
  await signInAsAdmin(page);
  await openDocument(page, "Second pass");

  await uploadCsv(page, IMPORT_CSV, "import.csv");
  await expect(
    indexTable(page).getByRole("row", { name: /Dom Casmurro/ }),
  ).toBeVisible();

  // The status reads Saved once the upload has reached the server.
  await expect(page.getByRole("status", { name: "Saved" })).toBeVisible();
});

test("a long list is read a page at a time, and one changed in between is not read twice", async ({
  page,
  colleague,
}) => {
  test.slow();

  await signInAsAdmin(page);

  // Start 22 documents, more than the 20 on a page. The list puts the most
  // recently changed first, so the first page runs from Batch 22 to Batch 03.
  for (let batch = 1; batch <= 22; batch += 1) {
    await openDocument(page, `Batch ${String(batch).padStart(2, "0")}`);
  }

  await page.goto("/admin/publications/documents");
  await expect(documents(page)).toHaveCount(20);
  await expect(documents(page).last()).toContainText("Batch 03");

  // A colleague renames Batch 01, the oldest. Renaming updates the document's
  // `updated_at`, which moves it to the top of the list.
  await signInAsContributor(colleague);
  await colleague.goto("/admin/publications/documents");
  await colleague.getByRole("button", { name: "Show more" }).click();

  await documents(colleague)
    .filter({ hasText: "Batch 01" })
    .getByRole("button", { name: "Rename" })
    .click();
  const field = colleague.getByLabel("Name of Batch 01");
  await field.fill("Batch 01, renamed");
  await field.press("Enter");
  await expect(
    documents(colleague).filter({ hasText: "Batch 01, renamed" }),
  ).toBeVisible();

  // The next page starts after the last document already loaded, Batch 03. An
  // offset of 20 would now start at Batch 03 and show it a second time.
  await page.getByRole("button", { name: "Show more" }).click();

  await expect(documents(page)).toHaveCount(21);
  await expect(documents(page).last()).toContainText("Batch 02");
  await expect(documents(page).filter({ hasText: "Batch 03" })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Show more" })).toHaveCount(0);

  // After a reload, the renamed document is first in the list.
  await page.reload();
  await expect(documents(page).first()).toContainText("Batch 01, renamed");
});
