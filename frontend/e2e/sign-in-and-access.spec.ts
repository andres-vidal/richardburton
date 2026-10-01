import { test, expect } from "./fixtures";
import { signInAsAdmin, signOut } from "./helpers";

test("signed out, the footer offers Google sign-in and hides admin controls", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Sign in with Google" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Admin" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Sign out" })).toHaveCount(0);
});

test("an admin signs in and out, and the footer controls follow", async ({
  page,
}) => {
  await signInAsAdmin(page);

  // Authenticated: admin + export controls appear.
  await expect(page.getByRole("button", { name: "Admin" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Download .csv" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sign in with Google" }),
  ).toHaveCount(0);

  await signOut(page);

  // Back to the signed-out footer.
  await expect(page.getByRole("button", { name: "Admin" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Sign out" })).toHaveCount(0);
});

test("signing out works from a page that is not the index", async ({
  page,
}) => {
  await signInAsAdmin(page);
  await page.goto("/admin/users");
  await expect(page.getByRole("heading", { name: "Access" })).toBeVisible();

  await signOut(page);

  // Back at the front door, and the page just left is closed to them.
  await expect(page).toHaveURL("/en");
  await page.goto("/admin/users");
  await expect(page).toHaveURL("/en");
});

test("a signed-out visitor cannot reach the admin workspace", async ({
  page,
}) => {
  // Go straight to the documents URL. The guard redirects a signed-out visitor
  // before the page renders.
  await page.goto("/admin/publications/documents");

  // The guard bounces the visitor back to the public index.
  await expect(page).toHaveURL("/en");
  await expect(
    page.getByRole("heading", { name: "Import documents" }),
  ).toHaveCount(0);
});

test("a signed-out visitor is turned back from every admin page that reads the database", async ({
  page,
}) => {
  // Each of these pages reads from the backend while it renders. The guard has
  // to redirect a signed-out visitor before that read runs.
  const pages = [
    { address: "/admin/publications/deleted", title: "Deleted publications" },
    { address: "/admin/publications/history", title: "History" },
    { address: "/admin/publications/duplicates", title: "Review duplicates" },
    { address: "/admin/publications/sources", title: "Backfill sources" },
  ];

  for (const { address, title } of pages) {
    await page.goto(address);

    await expect(page).toHaveURL("/en");
    await expect(page.getByRole("heading", { name: title })).toHaveCount(0);
  }
});
