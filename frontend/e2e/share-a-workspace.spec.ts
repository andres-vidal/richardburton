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

  // Reached the way a person reaches it, rather than by its address: a page
  // nothing links to is a page nobody finds.
  await page.goto("/admin");
  await page.getByRole("link", { name: /Workspaces/ }).click();
  await expect(page).toHaveURL(/\/admin\/publications\/workspaces$/);

  // Nothing kept yet.
  await expect(
    page.getByText("No workspaces yet. Start one above."),
  ).toBeVisible();

  await page.getByLabel("Name").fill("Second pass");
  await page.getByRole("button", { name: "Start a workspace" }).click();

  // Starting one opens it, under the name it was given rather than a generic
  // one — which is what tells one workspace from another.
  await expect(page).toHaveURL(/\/admin\/publications\/workspaces\/\d+$/);
  await expect(
    page.getByRole("heading", { name: "Second pass", level: 1 }),
  ).toBeVisible();
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

test("two people with the workspace open see each other's edits as they happen", async ({
  page,
  browser,
  baseURL,
}) => {
  await signInAsAdmin(page);
  await page.goto("/admin/publications/workspaces");

  await page.getByLabel("Name").fill("Together");
  await page.getByRole("button", { name: "Start a workspace" }).click();
  await expect(page).toHaveURL(/\/admin\/publications\/workspaces\/\d+$/);
  const address = page.url();

  await page.locator("#upload-csv").setInputFiles({
    name: "together.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(IMPORT_CSV),
  });

  const mine = indexTable(page);
  await expect(mine.getByRole("row", { name: /Dom Casmurro/ })).toBeVisible();

  // A second browser, with the same workspace open at the same time.
  const elsewhere = await browser.newContext({ baseURL });
  const other = await elsewhere.newPage();

  try {
    await signInAsAdmin(other);
    await other.goto(address);

    const theirs = indexTable(other);
    await expect(
      theirs.getByRole("row", { name: /Dom Casmurro/ }),
    ).toBeVisible();

    // Neither page is reloaded from here on.
    const title = mine.getByRole("textbox", { name: "Title" }).first();
    await title.fill("Dom Casmurro (revised)");
    await title.blur();

    await expect(
      theirs.getByRole("row", { name: /Dom Casmurro \(revised\)/ }),
    ).toBeVisible({ timeout: 15_000 });

    // And the other way, so it is a conversation rather than a broadcast.
    const back = theirs.getByRole("textbox", { name: "Title" }).nth(1);
    await back.fill("Iracema (revised)");
    await back.blur();

    await expect(
      mine.getByRole("row", { name: /Iracema \(revised\)/ }),
    ).toBeVisible({ timeout: 15_000 });
  } finally {
    await elsewhere.close();
  }
});
