import { test, expect } from "./fixtures";
import {
  CSV_HEADER,
  expectPublicationCount,
  indexTable,
  openDocument,
  signInAsAdmin,
  submitWorkspace,
  uploadCsv,
} from "./helpers";
import type { Page } from "@playwright/test";

/** Three rows, none of them in the database yet. */
const THREE_ROWS =
  [
    CSV_HEADER,
    `Dom Casmurro,1953,US,Noonday Press,Helen Caldwell,Dom Casmurro,Machado de Assis,`,
    `Iracema,1886,GB,Bickers & Son,Isabel Burton,Iracema,José de Alencar,`,
    `Barren Lives,1965,US,University of Texas Press,Ralph Dimmick,Vidas Secas,Graciliano Ramos,`,
  ].join("\n") + "\n";

/** Selects the row by its leading cell and discards it. */
async function discard(page: Page, title: RegExp) {
  await indexTable(page)
    .getByRole("row", { name: title })
    .getByRole("cell")
    .first()
    .click({ position: { x: 4, y: 4 } });
  await page.getByRole("button", { name: "Discard 1" }).click();
}

test("a row one person discards is discarded for everyone, stays discarded after a reload, and stays out of the submit", async ({
  page,
  colleague,
}) => {
  await signInAsAdmin(page);
  await openDocument(page, "Weeding");
  const address = page.url();

  await uploadCsv(page, THREE_ROWS, "weeding.csv");
  const mine = indexTable(page);
  await expect(mine.getByRole("row", { name: /Barren Lives/ })).toBeVisible();
  // The colleague reads the rows from the server, so wait until the upload is
  // saved.
  await expect(page.getByRole("status", { name: "Saved" })).toBeVisible();

  await signInAsAdmin(colleague);
  await colleague.goto(address);
  const theirs = indexTable(colleague);
  await expect(theirs.getByRole("row", { name: /Iracema/ })).toBeVisible();

  // The admin discards Iracema. It leaves both tables, and both offer to bring
  // it back.
  await discard(page, /Iracema/);
  await expect(mine.getByRole("row", { name: /Iracema/ })).toHaveCount(0);
  await expect(theirs.getByRole("row", { name: /Iracema/ })).toHaveCount(0, {
    timeout: 15_000,
  });
  await expect(
    colleague.getByRole("button", { name: "Reset 1 discarded" }),
  ).toBeVisible();

  // The discard is saved with the document, so it is still there after a
  // reload.
  await expect(page.getByRole("status", { name: "Saved" })).toBeVisible();
  await page.reload();
  await expect(mine.getByRole("row", { name: /Dom Casmurro/ })).toBeVisible();
  await expect(mine.getByRole("row", { name: /Iracema/ })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Reset 1 discarded" }),
  ).toBeVisible();

  // The colleague brings it back, and it returns for the admin too.
  await colleague.getByRole("button", { name: "Reset 1 discarded" }).click();
  await expect(mine.getByRole("row", { name: /Iracema/ })).toBeVisible({
    timeout: 15_000,
  });

  // The colleague discards Barren Lives, and the admin submits. Only the two
  // rows nobody discarded are inserted.
  await discard(colleague, /Barren Lives/);
  await expect(mine.getByRole("row", { name: /Barren Lives/ })).toHaveCount(0, {
    timeout: 15_000,
  });
  await submitWorkspace(page, 2);

  await page.goto("/");
  await expectPublicationCount(page, 2);
  await expect(
    indexTable(page).getByRole("row", { name: /Barren Lives/ }),
  ).toHaveCount(0);
});

test("undo brings back rows discarded by mistake, even when every row was discarded", async ({
  page,
}) => {
  await signInAsAdmin(page);
  await openDocument(page, "Oops");

  await uploadCsv(page, THREE_ROWS, "oops.csv");
  const table = indexTable(page);
  await expect(table.getByRole("row", { name: /Barren Lives/ })).toBeVisible();

  // Edit a title, then select every row and discard them all.
  const title = table
    .getByRole("row", { name: /Iracema/ })
    .getByPlaceholder("Title", { exact: true });
  await title.fill("Iracema, the Honey-Lips");
  await title.blur();

  for (const [index, name] of [
    /Dom Casmurro/,
    /Iracema/,
    /Barren Lives/,
  ].entries()) {
    await table
      .getByRole("row", { name })
      .getByRole("cell")
      .first()
      .click({ position: { x: 4, y: 4 }, modifiers: index ? ["Meta"] : [] });
  }
  await page.getByRole("button", { name: "Discard 3" }).click();
  await expect(table.getByRole("row", { name: /Dom Casmurro/ })).toHaveCount(0);

  // With every row discarded, Undo is still offered. One undo brings back all
  // three rows and keeps the edit made before the discard.
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(table.getByRole("row", { name: /Dom Casmurro/ })).toBeVisible();
  await expect(table.getByRole("row", { name: /Barren Lives/ })).toBeVisible();
  await expect(
    table.getByRole("row", { name: /Iracema, the Honey-Lips/ }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /discarded/ })).toHaveCount(0);
});
