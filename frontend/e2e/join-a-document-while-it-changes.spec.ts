import { test, expect } from "./fixtures";
import {
  signInAsAdmin,
  signInAsContributor,
  indexTable,
  openDocument,
  uploadCsv,
  IMPORT_CSV,
} from "./helpers";

test("a colleague who opens a document while a change is still being saved gets it all the same", async ({
  page,
  colleague,
}) => {
  await signInAsAdmin(page);
  await openDocument(page, "Still saving");
  const address = page.url();

  // This browser's saves are held back, so the upload is on its way to the
  // server but has not arrived when the colleague opens the document.
  let release = () => {};
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });

  await page.route("**/documents/*/updates", async (route) => {
    if (route.request().method() === "POST") await released;
    await route.continue();
  });

  await uploadCsv(page, IMPORT_CSV, "still-saving.csv");
  await expect(
    indexTable(page).getByRole("row", { name: /Dom Casmurro/ }),
  ).toBeVisible();
  await expect(page.getByRole("status", { name: "Saving" })).toBeVisible();

  await signInAsContributor(colleague);
  await colleague.goto(address);

  // The server does not have the rows yet, and they were relayed before the
  // colleague was here to hear them. They come from the person who has them.
  const theirs = indexTable(colleague);
  await expect(theirs.getByRole("row", { name: /Dom Casmurro/ })).toBeVisible({
    timeout: 15_000,
  });
  await expect(theirs.getByRole("row", { name: /Iracema/ })).toBeVisible();
  await expect(page.getByRole("status", { name: "Saving" })).toBeVisible();

  // And the save still goes through once it can.
  release();
  await expect(page.getByRole("status", { name: "Saved" })).toBeVisible();
});

test("work done away from the server reaches the colleagues already in the document", async ({
  page,
  colleague,
}) => {
  await signInAsAdmin(page);
  await openDocument(page, "Done offline");
  const address = page.url();

  await uploadCsv(page, IMPORT_CSV, "done-offline.csv");
  await expect(page.getByRole("status", { name: "Saved" })).toBeVisible();

  await signInAsContributor(colleague);
  await colleague.goto(address);

  const theirs = indexTable(colleague);
  await expect(theirs.getByRole("row", { name: /Dom Casmurro/ })).toBeVisible();

  // Away from the server entirely: nothing saves and nothing is relayed, so the
  // edit is on this browser's disk and nowhere else.
  await page.route("**/api/**", (route) => route.abort());
  await page.reload();

  // Restored from this browser's disk, which is what there is to edit.
  const mine = indexTable(page);
  await expect(mine.getByRole("row", { name: /Iracema/ })).toBeVisible();

  const title = mine.getByRole("textbox", { name: "Title" }).first();
  await title.fill("Dom Casmurro (offline)");
  await title.blur();
  await expect(theirs.getByRole("row", { name: /\(offline\)/ })).toHaveCount(0);

  // Back. Opening again saves what only this browser held, and the colleague,
  // who has had the document open all along, receives it without reloading.
  await page.unroute("**/api/**");
  await page.reload();

  await expect(
    theirs.getByRole("row", { name: /Dom Casmurro \(offline\)/ }),
  ).toBeVisible({ timeout: 15_000 });
});
