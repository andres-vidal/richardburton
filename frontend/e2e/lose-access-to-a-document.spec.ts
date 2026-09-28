import { test, expect } from "./fixtures";
import {
  signInAsAdmin,
  signOut,
  indexTable,
  openDocument,
  uploadCsv,
  IMPORT_CSV,
} from "./helpers";

test("the live connection carries no credential in its address", async ({
  page,
}) => {
  // Whatever authorises the connection travels in a header. In the address it
  // would be written into every request log between the browser and the
  // server.
  const addresses: string[] = [];
  page.on("websocket", (socket) => addresses.push(socket.url()));

  await signInAsAdmin(page);
  await openDocument(page, "Second pass");
  await expect(page.getByRole("status", { name: "Saved" })).toBeVisible();

  const document = addresses.filter((address) => address.includes("/socket/"));

  expect(document.length).toBeGreaterThan(0);
  document.forEach((address) => expect(address).not.toMatch(/token/i));
});

test("signing out closes a document left open in another tab", async ({
  page,
  context,
}) => {
  await signInAsAdmin(page);
  await openDocument(page, "Second pass");
  await uploadCsv(page, IMPORT_CSV);
  await expect(
    indexTable(page).getByRole("row", { name: /Dom Casmurro/ }),
  ).toBeVisible();
  await expect(page.getByRole("status", { name: "Saved" })).toBeVisible();

  // The same browser, so the same session, signed out from somewhere else.
  const elsewhere = await context.newPage();
  await elsewhere.goto("/");
  await signOut(elsewhere);

  // The open document stops being live rather than quietly carrying on as if
  // nothing had happened.
  await expect(page.getByRole("status", { name: "Not live" })).toBeVisible();
});
