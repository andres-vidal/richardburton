import { test, expect } from "./fixtures";
import { signInAsAdmin, indexTable, openDocument, CSV_HEADER } from "./helpers";

const IMPORT_CSV =
  [
    CSV_HEADER,
    `Dom Casmurro,1953,US,Noonday Press,Helen Caldwell,Dom Casmurro,Machado de Assis,`,
    `Iracema,1886,GB,Bickers & Son,Isabel Burton,Iracema,José de Alencar,`,
  ].join("\n") + "\n";

/** The list of documents, scoped past the breadcrumb, which is a list too. */
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

  // It is the same document, not a second one: the name is a correction.
  await expect(documents(page)).toHaveCount(1);

  // And it survives a reload, so it was the server that was told.
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

  // Something worth not destroying.
  await page.locator("#upload-csv").setInputFiles({
    name: "import.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(IMPORT_CSV),
  });
  await expect(
    indexTable(page).getByRole("row", { name: /Dom Casmurro/ }),
  ).toBeVisible();

  // The count the list shows is written with the rows, so the list is only
  // worth reading once the server has taken them.
  await expect(page.getByRole("status", { name: "Saved" })).toBeVisible();

  await page.goto("/admin/publications/documents");

  const entry = documents(page).filter({ hasText: "Abandoned sweep" });
  await expect(entry).toContainText("2 rows");
  await entry.getByRole("button", { name: "Archive" }).click();

  // Off the list, and the list says so rather than showing nothing.
  await expect(page.getByText("No documents yet")).toBeVisible();

  // Readable on the other side of the list, with what it held intact.
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

  // The rows were never the thing being retired.
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

  await page.locator("#upload-csv").setInputFiles({
    name: "import.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(IMPORT_CSV),
  });
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

  // Thinking better of it leaves every row where it was.
  await asking.getByRole("button", { name: "Keep them" }).click();
  await expect(asking).not.toBeVisible();
  await expect(
    indexTable(page).getByRole("row", { name: /Dom Casmurro/ }),
  ).toBeVisible();
});

test("a document says its work has been saved", async ({ page }) => {
  await signInAsAdmin(page);
  await openDocument(page, "Second pass");

  await page.locator("#upload-csv").setInputFiles({
    name: "import.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(IMPORT_CSV),
  });
  await expect(
    indexTable(page).getByRole("row", { name: /Dom Casmurro/ }),
  ).toBeVisible();

  // The one thing a person needs to know about a shared document: whether what
  // they did is anywhere but this computer.
  await expect(page.getByRole("status", { name: "Saved" })).toBeVisible();
});
