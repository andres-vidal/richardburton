import { test, expect } from "./fixtures";
import {
  signInAsAdmin,
  signInAsContributor,
  indexTable,
  openDocument,
  CSV_HEADER,
} from "./helpers";

const IMPORT_CSV =
  [
    CSV_HEADER,
    `Dom Casmurro,1953,US,Noonday Press,Helen Caldwell,Dom Casmurro,Machado de Assis,`,
    `Iracema,1886,GB,Bickers & Son,Isabel Burton,Iracema,José de Alencar,`,
  ].join("\n") + "\n";

test("an import document is reached from the menu and kept on the server", async ({
  page,
  browser,
  baseURL,
}) => {
  await signInAsAdmin(page);

  // Reached the way a person reaches it, rather than by its address.
  await page.goto("/admin");
  await page.getByRole("link", { name: /Add publications/ }).click();
  await expect(page).toHaveURL(/\/admin\/publications\/documents$/);

  await page.getByLabel("Name").fill("Second pass");
  await page.getByRole("button", { name: "Start a document" }).click();
  await expect(page).toHaveURL(/\/admin\/publications\/documents\/\d+$/);

  // Started under the name it was given, which is what tells it from another.
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

  // A browser of its own: nothing of this document is on its disk, so whatever
  // it shows had to come from the server.
  const elsewhere = await browser.newContext({ baseURL });
  const other = await elsewhere.newPage();

  try {
    await signInAsAdmin(other);
    await other.goto("/admin/publications/documents");

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

test("the list of documents is shared, so a colleague sees and opens one they did not start", async ({
  page,
  browser,
  baseURL,
}) => {
  await signInAsAdmin(page);
  await openDocument(page, "Between us");
  const address = page.url();

  await page.locator("#upload-csv").setInputFiles({
    name: "between-us.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(IMPORT_CSV),
  });
  await expect(
    indexTable(page).getByRole("row", { name: /Dom Casmurro/ }),
  ).toBeVisible();

  const theirs = await browser.newContext({ baseURL });
  const colleague = await theirs.newPage();

  try {
    // Somebody else entirely, who has never touched this document. There is no
    // owner and nothing to be let into: they simply see it.
    await signInAsContributor(colleague);
    await colleague.goto("/admin/publications/documents");

    await expect(
      colleague.getByRole("link", { name: /Between us/ }),
    ).toBeVisible();

    await colleague.goto(address);
    await expect(
      indexTable(colleague).getByRole("row", { name: /Dom Casmurro/ }),
    ).toBeVisible();

    // And an edit of theirs reaches the other without either page reloading.
    const title = indexTable(colleague)
      .getByRole("textbox", { name: "Title" })
      .first();
    await title.fill("Dom Casmurro (theirs)");
    await title.blur();

    await expect(
      indexTable(page).getByRole("row", { name: /Dom Casmurro \(theirs\)/ }),
    ).toBeVisible({ timeout: 15_000 });
  } finally {
    await theirs.close();
  }
});

test("two people with a document open see each other's edits as they happen", async ({
  page,
  browser,
  baseURL,
}) => {
  await signInAsAdmin(page);
  await openDocument(page, "Together");
  const address = page.url();

  await page.locator("#upload-csv").setInputFiles({
    name: "together.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(IMPORT_CSV),
  });

  const mine = indexTable(page);
  await expect(mine.getByRole("row", { name: /Dom Casmurro/ })).toBeVisible();

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
