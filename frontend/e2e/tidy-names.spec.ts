import { test, expect } from "./fixtures";
import {
  signInAsAdmin,
  seedCorpus,
  indexTable,
  openDocument,
  CSV_HEADER,
} from "./helpers";
import type { Page } from "@playwright/test";

/**
 * The items of the publishers list. The list is found by name because the
 * breadcrumb is also a list.
 */
const names = (page: Page) =>
  page.getByRole("list", { name: "Publishers" }).getByRole("listitem");

/**
 * The alert inside the page's main element. It is scoped to main because
 * Next's route announcer is also an alert.
 */
const alert = (page: Page) => page.getByRole("main").getByRole("alert");

/** Confirms the fold in the confirmation dialog. */
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

  // Three publications in the corpus credit Noonday Press.
  const noonday = page.getByLabel("Name, currently Noonday Press", {
    exact: true,
  });
  await expect(noonday).toBeVisible();
  await expect(names(page).first()).toContainText("3 publications");

  // Renaming to a free name changes the name without a fold.
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

  // Two publications, each with a different spelling of the same publisher.
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

  // Two spellings, with one publication each.
  await expect(names(page)).toHaveCount(2);

  const stray = page.getByLabel("Name, currently Penguin books", {
    exact: true,
  });
  await stray.fill("Penguin Books");
  await stray.press("Enter");

  // The dialog lists the publication that would be credited to the other
  // spelling, with a link that opens its page in a new tab.
  const affected = page
    .getByRole("dialog", { name: "Fold these two together?" })
    .getByRole("list", { name: "Publications credited to Penguin books" });
  await expect(affected.getByRole("link")).toHaveText(["Iracema (1886)"]);

  const [iracema] = await Promise.all([
    page.waitForEvent("popup"),
    affected.getByRole("link", { name: "Iracema (1886)" }).click(),
  ]);
  await expect(iracema).toHaveTitle(/Iracema/);
  await expect(
    iracema.getByRole("link", { name: "Penguin books", exact: true }),
  ).toBeVisible();

  // The fold happens only after it is confirmed.
  await agreeToFold(page);

  await expect(
    page.getByText("Penguin books folded into Penguin Books"),
  ).toBeVisible();

  // The publication's page now credits the spelling that was kept.
  await iracema.reload();
  await expect(
    iracema.getByRole("link", { name: "Penguin Books", exact: true }),
  ).toBeVisible();

  // One name is left, with both publications.
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

  // The dialog names the name to be deleted and the name it joins, lists the
  // publication that would move, and says there is no undo.
  const asking = page.getByRole("dialog", { name: "Fold these two together?" });
  await expect(asking).toContainText(
    "Penguin books would stop existing. The publication below would be credited to Penguin Books instead. There is no undo for this.",
  );
  await expect(asking.getByRole("listitem")).toHaveText(["Iracema (1886)"]);

  await asking.getByRole("button", { name: "Cancel" }).click();

  // Both spellings remain, and the field shows the stored name.
  await expect(names(page)).toHaveCount(2);
  await expect(stray).toHaveValue("Penguin books");
});

test("a rename that would leave two publications identical is refused", async ({
  page,
}) => {
  await signInAsAdmin(page);

  // The same publication twice, differing only in the spelling of the
  // publisher.
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

  // The rename would give two publications the same identity, so it is refused
  // and the alert lists the two publications.
  await expect(alert(page)).toContainText(
    "That would leave two publications identical",
  );
  await expect(alert(page)).toContainText("Dom Casmurro");

  // The misspelt name is unchanged.
  await expect(
    page.getByLabel("Name, currently Penguin books", { exact: true }),
  ).toBeVisible();

  // The alert links to both publications, and to the duplicate review, which
  // opens in a new tab.
  await expect(
    alert(page).getByRole("link", { name: "Dom Casmurro (1953)" }),
  ).toHaveCount(2);

  const [review] = await Promise.all([
    page.context().waitForEvent("page"),
    alert(page)
      .getByRole("link", { name: "Open the duplicate review" })
      .click(),
  ]);

  // The pair is waiting there. Merging it leaves one publication, which holds
  // both spellings of the publisher.
  await review
    .getByRole("button", { name: "Merge into the selected one" })
    .click();
  await expect(review.getByText(/Merged 1 publication/)).toBeVisible();
  await expect(review.getByText("Nothing to reconcile")).toBeVisible();
  await review.close();

  // Back on the names page, the same rename now goes through.
  await alert(page).getByRole("button", { name: "Close" }).click();
  await stray.fill("Penguin Books");
  await stray.press("Enter");
  await agreeToFold(page);

  await expect(
    page.getByText("Penguin books folded into Penguin Books"),
  ).toBeVisible();
  await expect(names(page)).toHaveCount(1);
  await expect(names(page)).toContainText("1 publication");
});
