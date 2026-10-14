import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import {
  CORPUS_SIZE,
  csv,
  expectMatchCount,
  expectPublicationCount,
  indexTable,
  notifications,
  openDocument,
  seedCorpus,
  signInAsAdmin,
  signOut,
  submitWorkspace,
  uploadCsv,
} from "./helpers";

/** The sentence a retranslation of Dom Casmurro says about the work. */
const FIRST_TRANSLATED = (year: number) =>
  `The work was first translated by Helen Caldwell as Dom Casmurro (${year}).`;

/** The sentence a reissue of Helen Caldwell's Dom Casmurro says about it. */
const FIRST_PUBLISHED =
  "This translation was first published as Dom Casmurro (1953).";

/**
 * Opens the publication translated by `translator` in `year` from its row in
 * the index, and returns its dialog once it is visible. The corpus has several
 * Dom Casmurros, so the row is found by its translator and year.
 */
async function openEdition(page: Page, translator: string, year: string) {
  await indexTable(page)
    .getByRole("row")
    .filter({ hasText: translator })
    .filter({ hasText: year })
    .click();

  const dialog = page.getByRole("dialog", { name: "Publication details" });
  await expect(dialog.getByRole("heading", { level: 1 })).toContainText(
    translator,
  );
  await expect(dialog).toContainText(`in ${year} by`);
  return dialog;
}

/**
 * Hovers the info icon named `label` in `scope`, and waits for its tooltip to
 * say `text`. The tooltip is found by CSS, since an open dialog hides the rest
 * of the page from the accessibility tree.
 */
async function expectHint(
  page: Page,
  scope: Locator,
  label: string,
  text: string,
) {
  await scope.getByRole("button", { name: label }).hover();
  await expect(page.locator('[role="tooltip"]')).toContainText(text);
}

/** Waits until `scope` says nothing about the kind of its publication. */
async function expectFirstTranslation(scope: Locator) {
  await expect(scope.getByText("Retranslation", { exact: true })).toHaveCount(
    0,
  );
  await expect(scope.getByText("Reissue", { exact: true })).toHaveCount(0);
}

test("a publication says whether it is a retranslation or a reissue, links to the publication it follows, and the answer changes when that publication is deleted and restored", async ({
  page,
}) => {
  test.slow();

  // The corpus holds Helen Caldwell's Dom Casmurro of 1953. John Gledson's of
  // 1997 is a second translation of the work, and Caldwell's of 1966 is her
  // translation published again.
  await seedCorpus(page);
  await openDocument(page, "Later editions");
  await uploadCsv(
    page,
    csv([
      `Dom Casmurro,1997,GB,Oxford University Press,John Gledson,Dom Casmurro,Machado de Assis,`,
      `Dom Casmurro,1966,US,University of California Press,Helen Caldwell,Dom Casmurro,Machado de Assis,`,
    ]),
    "later-editions.csv",
  );
  await submitWorkspace(page, 2);

  // Anyone can read the kind of a publication, signed in or not.
  await signOut(page);
  await page.goto("/");
  await expectPublicationCount(page, CORPUS_SIZE + 2);

  // Gledson's translation is a retranslation. It names the work's first
  // translation, and the hint defines the term.
  const dialog = await openEdition(page, "John Gledson", "1997");
  const retranslationPath = new URL(page.url()).pathname;
  await expect(
    dialog.getByText("Retranslation", { exact: true }),
  ).toBeVisible();
  await expect(dialog).toContainText(FIRST_TRANSLATED(1953));
  await expectHint(
    page,
    dialog,
    "About retranslations",
    "A retranslation is the first edition of a later translation of the same work.",
  );

  // Following the link opens the first translation in the overlay. It is a
  // first translation, so it says nothing about its kind.
  await dialog.getByRole("link", { name: "Dom Casmurro (1953)" }).click();
  await expect(dialog.getByRole("heading", { level: 1 })).toContainText(
    "Helen Caldwell",
  );
  await expect(dialog).toContainText("in 1953 by Noonday Press");
  await expectFirstTranslation(dialog);

  // Closing goes back to the retranslation, and then to the index.
  await page.keyboard.press("Escape");
  await expect(dialog.getByRole("heading", { level: 1 })).toContainText(
    "John Gledson",
  );
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);

  // Caldwell's 1966 publication is a reissue, judged over the whole database:
  // a search that finds it alone does not make it the first.
  const search = page.getByRole("textbox", { name: "Search publications" });
  await search.fill("California");
  await expectMatchCount(page, 1);

  const reissue = await openEdition(page, "Helen Caldwell", "1966");
  await expect(reissue.getByText("Reissue", { exact: true })).toBeVisible();
  await expect(reissue).toContainText(FIRST_PUBLISHED);
  await expectHint(
    page,
    reissue,
    "About reissues",
    "A reissue is any later edition of a translation.",
  );

  // The publication it follows is outside the search, and opens all the same.
  await reissue.getByRole("link", { name: "Dom Casmurro (1953)" }).click();
  await expect(reissue).toContainText("in 1953 by Noonday Press");
  await expectFirstTranslation(reissue);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(reissue).toHaveCount(0);
  await search.clear();
  await expectPublicationCount(page, CORPUS_SIZE + 2);

  // The publication's own page says the same, and its link opens the first
  // translation over it.
  await page.goto(retranslationPath);
  await expect(page.getByText("Retranslation", { exact: true })).toBeVisible();
  await expect(page.getByRole("main")).toContainText(FIRST_TRANSLATED(1953));
  await page.getByRole("link", { name: "Dom Casmurro (1953)" }).click();
  const over = page.getByRole("dialog", { name: "Publication details" });
  await expect(over).toContainText("in 1953 by Noonday Press");

  // Once the first translation is deleted, Caldwell's 1966 publication is the
  // first, and the retranslation follows it.
  await signInAsAdmin(page);
  const first = await openEdition(page, "Helen Caldwell", "1953");
  await first.getByRole("button", { name: "Delete" }).click();
  await page
    .getByRole("dialog", { name: "Delete this publication?" })
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(notifications(page)).toContainText("Publication deleted");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expectPublicationCount(page, CORPUS_SIZE + 1);

  const promoted = await openEdition(page, "Helen Caldwell", "1966");
  await expectFirstTranslation(promoted);
  await expect(promoted).not.toContainText(FIRST_PUBLISHED);
  await page.keyboard.press("Escape");
  await expect(promoted).toHaveCount(0);

  const retranslation = await openEdition(page, "John Gledson", "1997");
  await expect(retranslation).toContainText(FIRST_TRANSLATED(1966));
  await page.keyboard.press("Escape");

  // Restoring the deleted publication makes it the first translation again.
  await page.goto("/admin/publications/deleted");
  await page
    .getByRole("listitem")
    .filter({ hasText: "Dom Casmurro" })
    .getByRole("button", { name: "Restore" })
    .click();
  await expect(page.getByText("Publication restored")).toBeVisible();

  await page.goto("/");
  await expectPublicationCount(page, CORPUS_SIZE + 2);
  const restored = await openEdition(page, "John Gledson", "1997");
  await expect(restored).toContainText(FIRST_TRANSLATED(1953));
  await page.keyboard.press("Escape");

  const reissued = await openEdition(page, "Helen Caldwell", "1966");
  await expect(reissued).toContainText(FIRST_PUBLISHED);
});
