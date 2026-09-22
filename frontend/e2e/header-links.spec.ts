import { test, expect } from "./fixtures";
import { signInAsAdmin, openDocument } from "./helpers";

// The header is on every page, so what its links open has to be too. Rendered
// by the index alone, every other page had a link that led nowhere.
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
