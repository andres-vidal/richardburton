import { test, expect } from "./fixtures";
import { signInAsAdmin, indexTable, CSV_HEADER } from "./helpers";

const IMPORT_CSV =
  [
    CSV_HEADER,
    `Dom Casmurro,1953,US,Noonday Press,Helen Caldwell,Dom Casmurro,Machado de Assis,`,
    `Iracema,1886,GB,Bickers & Son,Isabel Burton,Iracema,José de Alencar,`,
  ].join("\n") + "\n";

test("a workspace kept on the server is opened again from another browser", async ({
  page,
  browser,
  baseURL,
}) => {
  await signInAsAdmin(page);
  await page.goto("/admin/publications/workspaces");

  // Nothing kept yet.
  await expect(
    page.getByText("No workspaces yet. Start one above."),
  ).toBeVisible();

  await page.getByLabel("Name").fill("Second pass");
  await page.getByRole("button", { name: "Start a workspace" }).click();

  // Starting one opens it.
  await expect(page).toHaveURL(/\/admin\/publications\/workspaces\/\d+$/);
  const address = page.url();

  await page.locator("#upload-csv").setInputFiles({
    name: "shared.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(IMPORT_CSV),
  });

  await expect(
    indexTable(page).getByRole("row", { name: /Dom Casmurro/ }),
  ).toBeVisible();

  // A browser of its own: nothing of this workspace is on its disk, so whatever
  // it shows had to come from the server.
  const elsewhere = await browser.newContext({ baseURL });
  const other = await elsewhere.newPage();

  try {
    await signInAsAdmin(other);
    await other.goto("/admin/publications/workspaces");

    // The workspace is listed, with the row count the first browser counted.
    await expect(
      other.getByRole("link", { name: /Second pass/ }),
    ).toContainText("2 rows");

    await other.goto(address);

    await expect(
      indexTable(other).getByRole("row", { name: /Dom Casmurro/ }),
    ).toBeVisible();
    await expect(
      indexTable(other).getByRole("row", { name: /Iracema/ }),
    ).toBeVisible();
  } finally {
    await elsewhere.close();
  }
});

test("an edit made in one browser reaches the workspace in another", async ({
  page,
  browser,
  baseURL,
}) => {
  await signInAsAdmin(page);
  await page.goto("/admin/publications/workspaces");

  await page.getByLabel("Name").fill("Second pass");
  await page.getByRole("button", { name: "Start a workspace" }).click();
  await expect(page).toHaveURL(/\/admin\/publications\/workspaces\/\d+$/);
  const address = page.url();

  await page.locator("#upload-csv").setInputFiles({
    name: "shared.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(IMPORT_CSV),
  });

  const title = indexTable(page)
    .getByRole("textbox", { name: "Title" })
    .first();
  await expect(title).toHaveValue("Dom Casmurro");
  await title.fill("Dom Casmurro (revised)");
  await title.blur();

  const elsewhere = await browser.newContext({ baseURL });
  const other = await elsewhere.newPage();

  try {
    await signInAsAdmin(other);
    await other.goto(address);

    // The edit, not just the upload: what the second browser opens is the
    // document as it now stands, not the file that started it.
    await expect(
      indexTable(other).getByRole("row", { name: /Dom Casmurro \(revised\)/ }),
    ).toBeVisible({ timeout: 30_000 });
  } finally {
    await elsewhere.close();
  }
});
