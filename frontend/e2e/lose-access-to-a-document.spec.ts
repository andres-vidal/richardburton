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
  // The socket signs in with the session cookie and sends the CSRF token in a
  // header, not in the URL. A token in the URL would be written into every
  // request log between the browser and the server.
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

  // Sign out from a second tab in the same browser context, which shares the
  // first tab's session.
  const elsewhere = await context.newPage();
  await elsewhere.goto("/");
  await signOut(elsewhere);

  // The server refuses the first tab's channel, and its status changes to
  // Not live.
  await expect(page.getByRole("status", { name: "Not live" })).toBeVisible();
});
