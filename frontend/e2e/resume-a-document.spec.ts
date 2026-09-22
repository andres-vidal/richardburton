import { test, expect } from "./fixtures";
import { signInAsAdmin, indexTable, CSV_HEADER, openDocument } from "./helpers";

const IMPORT_CSV =
  [
    CSV_HEADER,
    `Dom Casmurro,1953,US,Noonday Press,Helen Caldwell,Dom Casmurro,Machado de Assis,`,
    `Iracema,1886,GB,Bickers & Son,Isabel Burton,Iracema,José de Alencar,`,
  ].join("\n") + "\n";

test("work in the import document survives closing the tab", async ({
  page,
}) => {
  await signInAsAdmin(page);
  await openDocument(page);

  await page.locator("#upload-csv").setInputFiles({
    name: "resume.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(IMPORT_CSV),
  });

  const table = indexTable(page);
  await expect(table.getByRole("row", { name: /Dom Casmurro/ })).toBeVisible();

  // An edit made after the import, to prove it is the current value that is
  // kept rather than the file that was uploaded.
  const title = table.getByRole("textbox", { name: "Title" }).first();
  await title.fill("Dom Casmurro (revised)");
  await title.blur();

  await page.reload();

  // Nothing was ever submitted, so the database holds none of this: the rows
  // come back from the browser's own store.
  await expect(
    table.getByRole("row", { name: /Dom Casmurro \(revised\)/ }),
  ).toBeVisible();
  await expect(table.getByRole("row", { name: /Iracema/ })).toBeVisible();
});

test("a document resumed from disk still submits", async ({ page }) => {
  await signInAsAdmin(page);
  await openDocument(page);

  await page.locator("#upload-csv").setInputFiles({
    name: "resume.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(IMPORT_CSV),
  });

  const table = indexTable(page);
  await expect(table.getByRole("row", { name: /Dom Casmurro/ })).toBeVisible();

  await page.reload();
  await expect(table.getByRole("row", { name: /Iracema/ })).toBeVisible();

  // The submit path is unchanged: the rows are serialized to ordinary JSON and
  // posted, whatever they were held in while they were being edited.
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

  await page.locator("#upload-csv").setInputFiles({
    name: "resume.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(IMPORT_CSV),
  });

  const table = indexTable(page);
  await expect(table.getByRole("row", { name: /Dom Casmurro/ })).toBeVisible();

  // Take the API away entirely. Restoring the document is the browser reading
  // its own disk, so it must not need the server to be there at all.
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

  // The trailing row, typed into but never added.
  const table = indexTable(page);
  const draft = table.getByPlaceholder("Title", { exact: true }).last();
  await draft.fill("Iracema");
  await draft.blur();

  await page.reload();

  // It is unfinished, not discarded: it comes back where it was left.
  await expect(
    table.getByPlaceholder("Title", { exact: true }).last(),
  ).toHaveValue("Iracema");
});

test("a resumed document asks again whether its rows are valid", async ({
  page,
}) => {
  await signInAsAdmin(page);
  await openDocument(page);

  // A row with a title and nothing else: the database will refuse it.
  const table = indexTable(page);
  await table.getByPlaceholder("Title", { exact: true }).last().fill("Iracema");
  await page.getByRole("button", { name: "Add publication" }).click();

  await expect(page.getByLabel("1 invalid publication")).toBeVisible();

  await page.reload();

  // Whether a row is valid was the server's word and was never written down,
  // so a resumed document asks again rather than calling every row valid.
  await expect(page.getByLabel("1 invalid publication")).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole("button", { name: "Submit" })).toBeDisabled();
});
