import { test, expect } from "./fixtures";
import { signInAsAdmin, indexTable, CSV_HEADER } from "./helpers";

const IMPORT_CSV =
  [
    CSV_HEADER,
    `Dom Casmurro,1953,US,Noonday Press,Helen Caldwell,Dom Casmurro,Machado de Assis,`,
    `Iracema,1886,GB,Bickers & Son,Isabel Burton,Iracema,José de Alencar,`,
  ].join("\n") + "\n";

test("work in the bulk workspace survives closing the tab", async ({
  page,
}) => {
  await signInAsAdmin(page);
  await page.goto("/admin/publications/new");

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

test("a workspace resumed from disk still submits", async ({ page }) => {
  await signInAsAdmin(page);
  await page.goto("/admin/publications/new");

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

test("a workspace resumes with the backend unavailable", async ({ page }) => {
  await signInAsAdmin(page);
  await page.goto("/admin/publications/new");

  await page.locator("#upload-csv").setInputFiles({
    name: "resume.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(IMPORT_CSV),
  });

  const table = indexTable(page);
  await expect(table.getByRole("row", { name: /Dom Casmurro/ })).toBeVisible();

  // Take the API away entirely. Restoring the workspace is the browser reading
  // its own disk, so it must not need the server to be there at all.
  await page.route("**/api/**", (route) => route.abort());
  await page.reload();

  await expect(table.getByRole("row", { name: /Dom Casmurro/ })).toBeVisible();
  await expect(table.getByRole("row", { name: /Iracema/ })).toBeVisible();
});
