import { test, expect } from "./fixtures";
import {
  signInAsAdmin,
  signInAsContributor,
  indexTable,
  openDocument,
  uploadCsv,
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

test("replacing a shared document's rows is asked about before it happens", async ({
  page,
}) => {
  await signInAsAdmin(page);
  await openDocument(page, "Second pass");

  await uploadCsv(page, IMPORT_CSV, "import.csv");
  await expect(
    indexTable(page).getByRole("row", { name: /Dom Casmurro/ }),
  ).toBeVisible();

  await page.getByRole("button", { name: /Upload/ }).click();

  const asking = page.getByRole("dialog", {
    name: "Replace everything in this document?",
  });

  await expect(asking).toContainText("All 2 rows here");
  await expect(asking).toContainText(
    "Everyone working on this document loses them",
  );

  // Choosing "Keep them" closes the dialog and leaves the rows in place.
  await asking.getByRole("button", { name: "Keep them" }).click();
  await expect(asking).not.toBeVisible();
  await expect(
    indexTable(page).getByRole("row", { name: /Dom Casmurro/ }),
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
