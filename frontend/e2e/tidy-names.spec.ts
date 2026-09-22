import { test, expect } from "./fixtures";
import {
  signInAsAdmin,
  seedCorpus,
  indexTable,
  openDocument,
  CSV_HEADER,
} from "./helpers";
import type { Page } from "@playwright/test";

/** The names themselves, scoped past the breadcrumb, which is a list too. */
const names = (page: Page) =>
  page.getByRole("list", { name: "Publishers" }).getByRole("listitem");

/** What the page said, scoped past Next's route announcer, also an alert. */
const alert = (page: Page) => page.getByRole("main").getByRole("alert");

/** Say yes to the fold the page asks about before performing it. */
async function agreeToFold(page: Page) {
  const asking = page.getByRole("dialog", { name: "Fold these two together?" });
  await expect(asking).toBeVisible();

  await asking.getByRole("button", { name: "Fold them" }).click();
}

test("an admin folds two spellings of a publisher into one", async ({
  page,
}) => {
  await seedCorpus(page);

  await page.goto("/admin");
  await page.getByRole("link", { name: /Names/ }).click();
  await expect(page).toHaveURL(/\/admin\/vocabulary$/);

  await page.getByLabel("Find").fill("Noonday");

  // Three of the corpus are on it.
  const noonday = page.getByLabel("Name, currently Noonday Press", {
    exact: true,
  });
  await expect(noonday).toBeVisible();
  await expect(names(page).first()).toContainText("3 publications");

  // Correcting a spelling: the name changes, nothing is folded.
  await noonday.fill("Noonday");
  await noonday.press("Enter");

  await expect(page.getByText("Noonday Press is now Noonday")).toBeVisible();
  await expect(
    page.getByLabel("Name, currently Noonday", { exact: true }),
  ).toBeVisible();
});

test("renaming onto a name already taken folds the two together", async ({
  page,
}) => {
  await signInAsAdmin(page);

  // Two publications, one publisher each, spelled two ways.
  await openDocument(page);
  await page.locator("#upload-csv").setInputFiles({
    name: "spellings.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      [
        CSV_HEADER,
        `Dom Casmurro,1953,US,Penguin Books,Helen Caldwell,Dom Casmurro,Machado de Assis,`,
        `Iracema,1886,GB,Penguin books,Isabel Burton,Iracema,José de Alencar,`,
      ].join("\n") + "\n",
    ),
  });
  await expect(
    indexTable(page).getByRole("row", { name: /Dom Casmurro/ }),
  ).toBeVisible();

  const submit = page.getByRole("button", { name: "Submit" });
  await expect(submit).toBeEnabled({ timeout: 30_000 });
  await submit.click();
  await expect(
    page.getByText("2 publications inserted successfully"),
  ).toBeVisible({ timeout: 30_000 });

  await page.goto("/admin/vocabulary");
  await page.getByLabel("Find").fill("Penguin");

  // Two spellings, one publication each.
  await expect(names(page)).toHaveCount(2);

  const stray = page.getByLabel("Name, currently Penguin books", {
    exact: true,
  });
  await stray.fill("Penguin Books");
  await stray.press("Enter");

  // The fold is not done until it is asked for.
  await agreeToFold(page);

  await expect(
    page.getByText("Penguin books folded into Penguin Books"),
  ).toBeVisible();

  // One left, carrying both.
  await expect(names(page)).toHaveCount(1);
  await expect(names(page)).toContainText("2 publications");
});

test("a fold can be called off, and nothing moves", async ({ page }) => {
  await signInAsAdmin(page);

  await openDocument(page);
  await page.locator("#upload-csv").setInputFiles({
    name: "spellings.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      [
        CSV_HEADER,
        `Dom Casmurro,1953,US,Penguin Books,Helen Caldwell,Dom Casmurro,Machado de Assis,`,
        `Iracema,1886,GB,Penguin books,Isabel Burton,Iracema,José de Alencar,`,
      ].join("\n") + "\n",
    ),
  });

  const submit = page.getByRole("button", { name: "Submit" });
  await expect(submit).toBeEnabled({ timeout: 30_000 });
  await submit.click();
  await expect(
    page.getByText("2 publications inserted successfully"),
  ).toBeVisible({ timeout: 30_000 });

  await page.goto("/admin/vocabulary");
  await page.getByLabel("Find").fill("Penguin");

  const stray = page.getByLabel("Name, currently Penguin books", {
    exact: true,
  });
  await stray.fill("Penguin Books");
  await stray.press("Enter");

  // It says what would go, what it would join, and that there is no undo.
  const asking = page.getByRole("dialog", { name: "Fold these two together?" });
  await expect(asking).toContainText("Penguin books (1 publication)");
  await expect(asking).toContainText("Penguin Books (1 publication)");
  await expect(asking).toContainText("There is no undo for this.");

  await asking.getByRole("button", { name: "Cancel" }).click();

  // Both spellings still stand, and the field shows the one it is stored under.
  await expect(names(page)).toHaveCount(2);
  await expect(stray).toHaveValue("Penguin books");
});

test("a rename that would leave two publications identical is refused", async ({
  page,
}) => {
  await signInAsAdmin(page);

  // The same publication twice, told apart only by how the publisher is spelt.
  await openDocument(page);
  await page.locator("#upload-csv").setInputFiles({
    name: "hidden.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      [
        CSV_HEADER,
        `Dom Casmurro,1953,US,Penguin Books,Helen Caldwell,Dom Casmurro,Machado de Assis,`,
        `Dom Casmurro,1953,US,Penguin books,Helen Caldwell,Dom Casmurro,Machado de Assis,`,
      ].join("\n") + "\n",
    ),
  });

  const submit = page.getByRole("button", { name: "Submit" });
  await expect(submit).toBeEnabled({ timeout: 30_000 });
  await submit.click();
  await expect(
    page.getByText("2 publications inserted successfully"),
  ).toBeVisible({ timeout: 30_000 });

  await page.goto("/admin/vocabulary");
  await page.getByLabel("Find").fill("Penguin");

  const stray = page.getByLabel("Name, currently Penguin books", {
    exact: true,
  });
  await stray.fill("Penguin Books");
  await stray.press("Enter");
  await agreeToFold(page);

  // The database will not hold two records with one identity, so this says so
  // and names them rather than folding anything quietly.
  await expect(alert(page)).toContainText(
    "That would leave two publications identical",
  );
  await expect(alert(page)).toContainText("Dom Casmurro");

  // And nothing moved.
  await expect(
    page.getByLabel("Name, currently Penguin books", { exact: true }),
  ).toBeVisible();
});
