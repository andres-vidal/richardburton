import { test, expect } from "./fixtures";
import { signInAsAdmin, openDocument } from "./helpers";

// The header's "Learn More" and "Contact Us" links open modals. The header is
// on every page, so the modals have to open on every page, not only the index.
// This test checks them from an import document's page.
test("the header's links open from an admin page too", async ({ page }) => {
  await signInAsAdmin(page);
  await openDocument(page, "Modals");

  await page.getByRole("link", { name: "Learn More" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.getByRole("link", { name: "Contact Us" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
});
