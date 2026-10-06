import { test, expect } from "./fixtures";
import {
  signInAsAdmin,
  indexTable,
  openDocument,
  uploadCsv,
  IMPORT_CSV,
} from "./helpers";

test("work in the import document survives closing the tab", async ({
  page,
}) => {
  await signInAsAdmin(page);
  await openDocument(page);

  await uploadCsv(page, IMPORT_CSV, "resume.csv");

  const table = indexTable(page);
  await expect(table.getByRole("row", { name: /Dom Casmurro/ })).toBeVisible();

  // Edit a title after the upload, to check that the reload restores the edited
  // value and not the uploaded one.
  const title = table.getByRole("textbox", { name: "Title" }).first();
  await title.fill("Dom Casmurro (revised)");
  await title.blur();

  await page.reload();

  // Nothing was submitted, so the publications table holds none of these rows.
  // They are restored from the document, which is kept in this browser's
  // IndexedDB and in the updates stored on the server.
  await expect(
    table.getByRole("row", { name: /Dom Casmurro \(revised\)/ }),
  ).toBeVisible();
  await expect(table.getByRole("row", { name: /Iracema/ })).toBeVisible();
});

test("a document resumed from disk still submits", async ({ page }) => {
  await signInAsAdmin(page);
  await openDocument(page);

  await uploadCsv(page, IMPORT_CSV, "resume.csv");

  const table = indexTable(page);
  await expect(table.getByRole("row", { name: /Dom Casmurro/ })).toBeVisible();

  await page.reload();
  await expect(table.getByRole("row", { name: /Iracema/ })).toBeVisible();

  // Submit reads the rows from the store and posts them as JSON, so restored
  // rows submit the same way as rows entered in this session.
  const submit = page.getByRole("button", { name: "Submit" });
  await expect(submit).toBeEnabled({ timeout: 30_000 });
  await submit.click();

  await expect(
    page.getByText("2 publications inserted successfully"),
  ).toBeVisible({ timeout: 30_000 });
});

test("a document resumes with the backend unavailable", async ({ page }) => {
  await signInAsAdmin(page);
  await openDocument(page);

  await uploadCsv(page, IMPORT_CSV, "resume.csv");

  const table = indexTable(page);
  await expect(table.getByRole("row", { name: /Dom Casmurro/ })).toBeVisible();

  // Block every API request and reload. The document is restored from this
  // browser's IndexedDB, so it opens without the server.
  await page.route("**/api/**", (route) => route.abort());
  await page.reload();

  await expect(table.getByRole("row", { name: /Dom Casmurro/ })).toBeVisible();
  await expect(table.getByRole("row", { name: /Iracema/ })).toBeVisible();
});

test("a row half-typed into the new-publication row survives a reload", async ({
  page,
}) => {
  await signInAsAdmin(page);
  await openDocument(page);

  // Type a title into the new-publication row at the end of the table, without
  // adding the row.
  const table = indexTable(page);
  const draft = table.getByPlaceholder("Title", { exact: true }).last();
  await draft.fill("Iracema");
  await draft.blur();

  await page.reload();

  // The draft row is kept in localStorage, so the title is still there after
  // the reload.
  await expect(
    table.getByPlaceholder("Title", { exact: true }).last(),
  ).toHaveValue("Iracema");
});

test("a resumed document asks again whether its rows are valid", async ({
  page,
}) => {
  await signInAsAdmin(page);
  await openDocument(page);

  // Add a row with only a title. The server's validation marks it invalid.
  const table = indexTable(page);
  await table.getByPlaceholder("Title", { exact: true }).last().fill("Iracema");
  await page.getByRole("button", { name: "Add publication" }).click();

  await expect(page.getByLabel("1 invalid publication")).toBeVisible();

  await page.reload();

  // The document stores the result of validating the row, so the row is still
  // invalid after the reload and Submit stays disabled. Once the document has
  // loaded, the page also sends its rows to be validated again, since a stored
  // result can be out of date with the database.
  await expect(page.getByLabel("1 invalid publication")).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole("button", { name: "Submit" })).toBeDisabled();
});

// Reopening a document validates every row again. The rows keep their stored
// results meanwhile, so Submit stays enabled through a slow check, and an edit
// disables it only until that row is checked again.
test("a resumed document can be submitted while its rows are checked again", async ({
  page,
}) => {
  await signInAsAdmin(page);
  await openDocument(page);
  await uploadCsv(page, IMPORT_CSV, "resume.csv");

  const table = indexTable(page);
  const submit = page.getByRole("button", { name: "Submit" });
  await expect(submit).toBeEnabled({ timeout: 30_000 });

  // From here on, every validation answers 8 seconds late.
  await page.route("**/publications/validate", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 8_000));
    await route.continue();
  });

  await page.reload();
  await expect(table.getByRole("row", { name: /Iracema/ })).toBeVisible();
  await expect(submit).toBeEnabled({ timeout: 4_000 });

  const title = table.getByRole("textbox", { name: "Title" }).first();
  await title.fill("Dom Casmurro (revised)");
  await title.blur();

  await expect(submit).toBeDisabled();
  await expect(submit).toBeEnabled({ timeout: 30_000 });

  await submit.click();
  await expect(
    page.getByText("2 publications inserted successfully"),
  ).toBeVisible({ timeout: 30_000 });
});
