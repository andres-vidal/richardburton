import { test, expect } from "./fixtures";
import {
  signInAsAdmin,
  signInAsContributor,
  indexTable,
  openDocument,
  uploadCsv,
  IMPORT_CSV,
} from "./helpers";

test("an import document is reached from the menu and kept on the server", async ({
  page,
  colleague,
}) => {
  await signInAsAdmin(page);

  // Open the documents page from the admin menu rather than by its URL.
  await page.goto("/admin");
  await page.getByRole("link", { name: /Add publications/ }).click();
  await expect(page).toHaveURL(/\/admin\/publications\/documents$/);

  await page.getByLabel("Name").fill("Second pass");
  await page.getByRole("button", { name: "Start a document" }).click();
  await expect(page).toHaveURL(/\/admin\/publications\/documents\/\d+$/);

  // The document's page is headed by the name it was started with.
  await expect(
    page.getByRole("heading", { name: "Second pass", level: 1 }),
  ).toBeVisible();
  const address = page.url();

  await uploadCsv(page, IMPORT_CSV, "shared.csv");
  await expect(
    indexTable(page).getByRole("row", { name: /Dom Casmurro/ }),
  ).toBeVisible();
  // The colleague reads the rows from the server, so wait until the upload is
  // saved.
  await expect(page.getByRole("status", { name: "Saved" })).toBeVisible();

  // The colleague's browser context has no copy of this document in its
  // IndexedDB, so the row count and the rows it shows are read from the server.
  await signInAsAdmin(colleague);
  await colleague.goto("/admin/publications/documents");

  await expect(
    colleague.getByRole("link", { name: /Second pass/ }),
  ).toContainText("2 rows");

  await colleague.goto(address);

  await expect(
    indexTable(colleague).getByRole("row", { name: /Dom Casmurro/ }),
  ).toBeVisible();
  await expect(
    indexTable(colleague).getByRole("row", { name: /Iracema/ }),
  ).toBeVisible();
});

test("the list of documents is shared, so a colleague sees and opens one they did not start", async ({
  page,
  colleague,
}) => {
  await signInAsAdmin(page);
  await openDocument(page, "Between us");
  const address = page.url();

  await uploadCsv(page, IMPORT_CSV, "between-us.csv");
  await expect(
    indexTable(page).getByRole("row", { name: /Dom Casmurro/ }),
  ).toBeVisible();
  // The colleague reads the rows from the server, so wait until the upload is
  // saved.
  await expect(page.getByRole("status", { name: "Saved" })).toBeVisible();

  // Sign in as the contributor, who did not start this document. Documents have
  // no owner and no sharing step, so the contributor sees it in the list.
  await signInAsContributor(colleague);
  await colleague.goto("/admin/publications/documents");

  await expect(
    colleague.getByRole("link", { name: /Between us/ }),
  ).toBeVisible();

  await colleague.goto(address);
  await expect(
    indexTable(colleague).getByRole("row", { name: /Dom Casmurro/ }),
  ).toBeVisible();

  // An edit on the colleague's page reaches the admin's page, and neither page
  // reloads.
  const title = indexTable(colleague)
    .getByRole("textbox", { name: "Title" })
    .first();
  await title.fill("Dom Casmurro (theirs)");
  await title.blur();

  await expect(
    indexTable(page).getByRole("row", {
      name: /Dom Casmurro \(theirs\)/,
    }),
  ).toBeVisible({ timeout: 15_000 });
});

test("two people with a document open see each other's edits as they happen", async ({
  page,
  colleague,
}) => {
  await signInAsAdmin(page);
  await openDocument(page, "Together");
  const address = page.url();

  await uploadCsv(page, IMPORT_CSV, "together.csv");

  const mine = indexTable(page);
  await expect(mine.getByRole("row", { name: /Dom Casmurro/ })).toBeVisible();
  // The colleague reads the rows from the server, so wait until the upload is
  // saved.
  await expect(page.getByRole("status", { name: "Saved" })).toBeVisible();

  await signInAsAdmin(colleague);
  await colleague.goto(address);

  const theirs = indexTable(colleague);
  await expect(theirs.getByRole("row", { name: /Dom Casmurro/ })).toBeVisible();

  // Neither page is reloaded from here on.
  const title = mine.getByRole("textbox", { name: "Title" }).first();
  await title.fill("Dom Casmurro (revised)");
  await title.blur();

  await expect(
    theirs.getByRole("row", { name: /Dom Casmurro \(revised\)/ }),
  ).toBeVisible({ timeout: 15_000 });

  // Edit on the colleague's page too, and check that it reaches the admin's.
  const back = theirs.getByRole("textbox", { name: "Title" }).nth(1);
  await back.fill("Iracema (revised)");
  await back.blur();

  await expect(
    mine.getByRole("row", { name: /Iracema \(revised\)/ }),
  ).toBeVisible({ timeout: 15_000 });
});

test("each person sees who else has the document open", async ({
  page,
  colleague,
}) => {
  await signInAsAdmin(page);
  await openDocument(page, "Who is here");
  const address = page.url();

  // With nobody else in the document, the "Also here" list is not rendered.
  await expect(page.getByRole("list", { name: "Also here" })).toHaveCount(0);

  await signInAsContributor(colleague);
  await colleague.goto(address);

  // Each page shows the other person by the email they signed in with.
  await expect(page.getByLabel("dev-contributor@localhost")).toBeVisible({
    timeout: 15_000,
  });
  await expect(colleague.getByLabel("dev-admin@localhost")).toBeVisible({
    timeout: 15_000,
  });

  // Closing the colleague's page removes them from the admin's "Also here"
  // list. The server tracks presence per open connection and does not store
  // it.
  await colleague.close();

  await expect(page.getByLabel("dev-contributor@localhost")).toHaveCount(0, {
    timeout: 15_000,
  });
});

test("each person sees which cell the other is in", async ({
  page,
  colleague,
}) => {
  await signInAsAdmin(page);
  await openDocument(page, "Where is everyone");
  const address = page.url();

  await uploadCsv(page, IMPORT_CSV, "where.csv");
  await expect(
    indexTable(page).getByRole("row", { name: /Dom Casmurro/ }),
  ).toBeVisible();
  // The colleague reads the rows from the server, so wait until the upload is
  // saved.
  await expect(page.getByRole("status", { name: "Saved" })).toBeVisible();

  await signInAsContributor(colleague);
  await colleague.goto(address);
  await expect(
    indexTable(colleague).getByRole("row", { name: /Dom Casmurro/ }),
  ).toBeVisible();

  // No cell is marked with anyone's cursor yet.
  await expect(page.locator("[data-taken]")).toHaveCount(0);

  // The colleague puts the cursor in the first title.
  await indexTable(colleague)
    .getByRole("textbox", { name: "Title" })
    .first()
    .focus();

  // The admin's page marks that cell with `data-taken`, and labels it with the
  // colleague's email without needing a hover.
  const taken = page.locator("[data-taken]");
  await expect(taken).toHaveCount(1, { timeout: 15_000 });
  await expect(
    page.getByLabel("dev-contributor@localhost has their cursor here"),
  ).toBeVisible();

  // When the colleague moves to the Year cell, the mark moves with them, so
  // exactly one cell is still marked.
  await indexTable(colleague)
    .getByRole("textbox", { name: "Year" })
    .first()
    .focus();

  await expect(page.locator("[data-taken]")).toHaveCount(1, {
    timeout: 15_000,
  });
});

test("one person with two tabs open is one person, not two", async ({
  page,
  colleague,
  colleagueContext,
}) => {
  await signInAsAdmin(page);
  await openDocument(page, "Same person twice");
  const address = page.url();

  await signInAsContributor(colleague);
  await colleague.goto(address);

  await expect(page.getByLabel("dev-contributor@localhost")).toBeVisible({
    timeout: 15_000,
  });

  // The colleague opens the document again in a second tab. Presence has one
  // entry per connection, and the "Also here" list shows one entry per email,
  // so the colleague appears once.
  const second = await colleagueContext.newPage();
  await second.goto(address);
  await expect(
    indexTable(second).getByRole("row", { name: /Title/ }).first(),
  ).toBeVisible({ timeout: 15_000 });

  await expect(page.getByLabel("dev-contributor@localhost")).toHaveCount(1, {
    timeout: 15_000,
  });
});
