import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import { signInAsAdmin, signInAsContributor } from "./helpers";

const ACCESS_PAGE = "/admin/users";

/** Roles are picked from the app's menu, not a platform select. */
async function pickRole(page: Page, label: string, role: string) {
  await page.getByRole("combobox", { name: label }).click();
  await page.getByRole("option", { name: role, exact: true }).click();
}

test("an admin invites someone, changes what they may do, and revokes it", async ({
  page,
}) => {
  // A contributor account, so the list has someone in it whose role can be
  // changed: the provider mints an account on a first sign-in and nowhere else.
  await signInAsContributor(page);
  await signInAsAdmin(page);
  await page.goto(ACCESS_PAGE);

  // Someone who has never signed in cannot be granted a role outright — the
  // provider mints their account, and only on that first sign-in — so the offer
  // waits on the address.
  await page.getByLabel("Email address").fill("newcomer@example.com");
  await pickRole(page, "Role to invite as", "Contributor");
  await page.getByRole("button", { name: "Invite" }).click();

  const invitations = page.getByRole("listitem").filter({
    hasText: "newcomer@example.com",
  });
  await expect(invitations.getByText("waiting")).toBeVisible();
  await expect(page.getByText(/Invited as Contributor/)).toBeVisible();

  // It can be chased or withdrawn while it waits.
  await invitations.getByRole("button", { name: "Send again" }).click();
  await expect(page.getByText("Invitation sent again")).toBeVisible();

  await invitations.getByRole("button", { name: "Withdraw" }).click();
  await expect(page.getByText("newcomer@example.com")).toHaveCount(0);

  // Someone already here needs no invitation: the role is theirs at once.
  const contributor = page.getByRole("listitem").filter({
    hasText: "dev-contributor@localhost",
  });
  await expect(contributor).toBeVisible();

  await pickRole(page, "Role for dev-contributor@localhost", "Reader");
  await expect(page.getByText("Role changed")).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Role for dev-contributor@localhost" }),
  ).toHaveText("Reader");

  // Revoking asks first, then takes the account and its sessions with it. The
  // row goes; the notification naming them is not the list, so scope to it.
  await contributor.getByRole("button", { name: "Revoke" }).click();
  await page.getByRole("button", { name: "Revoke" }).last().click();
  await expect(page.getByText("Access revoked")).toBeVisible();
  await expect(contributor).toHaveCount(0);
});

test("an admin cannot change or revoke their own access", async ({ page }) => {
  await signInAsAdmin(page);
  await page.goto(ACCESS_PAGE);

  const mine = page.getByRole("listitem").filter({
    hasText: "dev-admin@localhost",
  });

  await expect(mine.getByText("(you)")).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Role for dev-admin@localhost" }),
  ).toBeDisabled();
  await expect(mine.getByRole("button", { name: "Revoke" })).toBeDisabled();

  // Nor by the back way in: inviting your own address is a change of your own
  // role, and meets the same refusal.
  await page.getByLabel("Email address").fill("dev-admin@localhost");
  await pickRole(page, "Role to invite as", "Reader");
  await page.getByRole("button", { name: "Invite" }).click();

  await expect(page.getByText("Could not invite")).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Role for dev-admin@localhost" }),
  ).toHaveText("Administrator");
});

test("a contributor edits publications but cannot say who may", async ({
  page,
}) => {
  await signInAsContributor(page);

  // The database is theirs: the admin hub and its editing tools are reachable.
  await page.goto("/admin");
  await expect(
    page.getByRole("link", { name: /Add publications/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Backfill sources/ }),
  ).toBeVisible();

  // Deciding who has access is not, so it is not offered...
  await expect(page.getByRole("link", { name: /Access/ })).toHaveCount(0);

  // ...and not reachable by address either.
  await page.goto(ACCESS_PAGE);
  await expect(page).toHaveURL(/\/admin$/);
});

test("someone with an account but no role is told access is pending, not denied", async ({
  page,
}) => {
  await page.goto("/auth/sign-in");
  await page.getByRole("button", { name: "Reader", exact: true }).click();

  await expect(page).toHaveURL(/\/auth\/pending/);
  await expect(
    page.getByRole("heading", { name: "Your account is ready" }),
  ).toBeVisible();
  await expect(page.getByText(/Your role is Reader/)).toBeVisible();

  // Turned back at the gate, so no session came with it.
  await expect(page.getByRole("button", { name: "Sign out" })).toHaveCount(0);
});
