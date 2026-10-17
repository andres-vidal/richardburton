import { test, expect } from "./fixtures";
import type { Page } from "@playwright/test";
import {
  agreeToFold,
  csv,
  historyEntries,
  signInAsAdmin,
  seedCorpus,
  indexTable,
  openDocument,
  submitWorkspace,
  uploadCsv,
} from "./helpers";

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

/** The dialog that shows a publication over the page it was opened from. */
const publicationDialog = (page: Page) =>
  page.getByRole("dialog", { name: "Publication details" });

/** The corpus's publications that Noonday Press published, by title. */
const NOONDAY_PUBLICATIONS = [
  "Dom Casmurro (1953)",
  "Epitaph of a Small Winner (1952)",
  "Philosopher or Dog? (1954)",
];

/** Two publications, each with a different spelling of one publisher. */
const SPELLINGS_CSV = csv([
  `Dom Casmurro,1953,US,Penguin Books,Helen Caldwell,Dom Casmurro,Machado de Assis,`,
  `Iracema,1886,GB,Penguin books,Isabel Burton,Iracema,José de Alencar,`,
]);

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

  // The history feed shows the rename as one item about the name, under the
  // admin who made it, listing the three publications it changed. It has no
  // undo of its own: the name is changed back here, in Names.
  await page.goto("/admin/publications/history");
  const renamed = historyEntries(page, "renamed");
  await expect(renamed).toHaveCount(1);
  await expect(renamed).toContainText(
    "Publisher “Noonday Press” renamed “Noonday”",
  );
  await expect(renamed).toContainText("by dev-admin@localhost");
  await expect(renamed).toContainText("In 3 publications:");
  await expect(renamed.getByRole("link")).toHaveText(NOONDAY_PUBLICATIONS);
  await expect(renamed.getByRole("button", { name: "Undo" })).toHaveCount(0);

  // The text filter finds the rename by any publication it changed, as it
  // finds that publication's import.
  const filter = page.getByRole("textbox", { name: "Filter by title or user" });
  await filter.fill("Philosopher");
  await expect(renamed).toHaveCount(1);
  await expect(historyEntries(page, "created")).toHaveCount(1);
  await filter.fill("");

  // Each publication links to its page, which opens over the feed and credits
  // the new name. Its own history shows the change as one of the name, made in
  // Names, and links to the other two publications.
  await renamed
    .getByRole("link", { name: "Epitaph of a Small Winner (1952)" })
    .click();
  await expect(page).toHaveURL(/\/publications\/\d+$/);
  const epitaph = publicationDialog(page);
  await expect(
    epitaph.getByRole("heading", { name: "Epitaph of a Small Winner" }),
  ).toBeVisible();
  await expect(
    epitaph.getByRole("link", { name: "Noonday", exact: true }),
  ).toBeVisible();

  await epitaph.getByText("History", { exact: true }).click();
  const own = historyEntries(epitaph, "renamed");
  await expect(own).toContainText(
    "Publisher “Noonday Press” renamed “Noonday” in Names",
  );
  await expect(own).toContainText("Also in:");
  await expect(own.getByRole("link")).toHaveText([
    "Dom Casmurro (1953)",
    "Philosopher or Dog? (1954)",
  ]);

  // Those links lead on to the other publications, whose history names
  // Epitaph of a Small Winner among the others.
  await own.getByRole("link", { name: "Philosopher or Dog? (1954)" }).click();
  const philosopher = publicationDialog(page);
  await expect(
    philosopher.getByRole("heading", { name: "Philosopher or Dog?" }),
  ).toBeVisible();
  await philosopher.getByText("History", { exact: true }).click();
  await expect(
    historyEntries(philosopher, "renamed").getByRole("link"),
  ).toHaveText(["Dom Casmurro (1953)", "Epitaph of a Small Winner (1952)"]);
});

test("renaming onto a name already taken folds the two together", async ({
  page,
}) => {
  await signInAsAdmin(page);

  await openDocument(page);
  await uploadCsv(page, SPELLINGS_CSV, "spellings.csv");
  await expect(
    indexTable(page).getByRole("row", { name: /Dom Casmurro/ }),
  ).toBeVisible();
  await submitWorkspace(page, 2);

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

  // The feed shows the fold as the stray spelling renamed to the kept one, on
  // the one publication that moved to it.
  await page.goto("/admin/publications/history");
  const folded = historyEntries(page, "renamed");
  await expect(folded).toHaveCount(1);
  await expect(folded).toContainText(
    "Publisher “Penguin books” renamed “Penguin Books”",
  );
  await expect(folded).toContainText("In 1 publication:");
  await expect(folded.getByRole("link")).toHaveText(["Iracema (1886)"]);
});

test("a fold can be called off, and nothing moves", async ({ page }) => {
  await signInAsAdmin(page);

  await openDocument(page);
  await uploadCsv(page, SPELLINGS_CSV, "spellings.csv");
  await submitWorkspace(page, 2);

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
  await uploadCsv(
    page,
    csv([
      `Dom Casmurro,1953,US,Penguin Books,Helen Caldwell,Dom Casmurro,Machado de Assis,`,
      `Dom Casmurro,1953,US,Penguin books,Helen Caldwell,Dom Casmurro,Machado de Assis,`,
    ]),
    "hidden.csv",
  );
  await submitWorkspace(page, 2);

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

  // The merged publication already credited the kept spelling, so the feed
  // says the stray one was folded into a name it already credits.
  await page.goto("/admin/publications/history");
  const folded = historyEntries(page, "renamed");
  await expect(folded).toHaveCount(1);
  await expect(folded).toContainText(
    "Publisher “Penguin books” folded into a name already credited",
  );
  await expect(folded.getByRole("link")).toHaveText(["Dom Casmurro (1953)"]);
});
