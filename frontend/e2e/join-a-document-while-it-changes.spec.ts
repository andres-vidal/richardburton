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

  // Hold this page's POSTs of document updates until `release` is called, so
  // the server has not stored the upload when the colleague opens the
  // document.
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

  // The server has not stored the rows yet, and the channel relayed them before
  // the colleague joined. The colleague's page sends its state vector when it
  // joins, and the admin's page answers with the rows it is missing.
  const theirs = indexTable(colleague);
  await expect(theirs.getByRole("row", { name: /Dom Casmurro/ })).toBeVisible({
    timeout: 15_000,
  });
  await expect(theirs.getByRole("row", { name: /Iracema/ })).toBeVisible();
  await expect(page.getByRole("status", { name: "Saving" })).toBeVisible();

  // Once the held POSTs are released, the save completes.
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

  // Block every API request and the socket, and reload. The page can neither
  // save nor join the channel, so the next edit is kept only in this browser's
  // IndexedDB.
  await page.route("**/api/**", (route) => route.abort());
  await page.routeWebSocket(/\/socket\/websocket/, (socket) => socket.close());
  await page.reload();

  // The rows are restored from this browser's IndexedDB.
  const mine = indexTable(page);
  await expect(mine.getByRole("row", { name: /Iracema/ })).toBeVisible();

  const title = mine.getByRole("textbox", { name: "Title" }).first();
  await title.fill("Dom Casmurro (offline)");
  await title.blur();
  await expect(theirs.getByRole("row", { name: /\(offline\)/ })).toHaveCount(0);

  // Open the document again in a new tab of the same browser, which shares its
  // IndexedDB and cookies. Playwright cannot remove a WebSocket route, so the
  // blocked tab is closed instead of unblocked. The new tab posts the edit the
  // server is missing, and joins the channel. The state vector exchange on
  // joining sends the edit to the colleague's page, which has stayed open and
  // does not reload.
  const back = await page.context().newPage();
  await page.close();
  await back.goto(address);

  await expect(
    theirs.getByRole("row", { name: /Dom Casmurro \(offline\)/ }),
  ).toBeVisible({ timeout: 15_000 });
});
