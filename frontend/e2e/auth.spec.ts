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
