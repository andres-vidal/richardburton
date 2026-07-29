import { test, expect } from "./fixtures";
import {
  commitMulti,
  draftRow,
  expectPublicationCount,
  expectPublicationRow,
  openPublicationModal,
  seedCorpus,
  selectEnumOption,
  submitWorkspace,
  CORPUS_SIZE,
} from "./helpers";

// A second translation of a book the corpus already holds. Its original title
// and authors must come out exactly as the seeded record spells them — that is
// what keeps the two publications pointing at one original book.
const SECOND_TRANSLATION = {
  title: "Dom Casmurro (Gledson)",
  year: "1997",
  authors: "John Gledson",
  country: "United Kingdom",
  publisher: "Bloomsbury",
};

test("entering a translation of a book already in the database completes it from one field", async ({
  page,
}) => {
  await seedCorpus(page);
  await page.goto("/admin/publications/new");

  const row = draftRow(page);
  const originalTitle = row.getByPlaceholder("Original Title", { exact: true });

  // Typing part of the author finds the book: either half of it will do.
  await originalTitle.fill("Machado");
  const byAuthor = page.getByRole("option", {
    name: "Dom Casmurro — Machado de Assis",
  });
  await expect(byAuthor).toBeVisible();

  // The corpus holds three works by that author, and each is offered whole.
  await expect(page.getByRole("option")).toHaveCount(3);

  // Typing the title narrows to the one book, and picking it fills both halves.
  await originalTitle.fill("Dom Cas");
  await page
    .getByRole("option", { name: "Dom Casmurro — Machado de Assis" })
    .click();

  await expect(originalTitle).toHaveValue("Dom Casmurro");
  await expect(
    row.getByText("Machado de Assis", { exact: true }),
  ).toBeVisible();

  // The rest of the row is this translation's own.
  await row
    .getByPlaceholder("Title", { exact: true })
    .fill(SECOND_TRANSLATION.title);
  await row
    .getByPlaceholder("Year", { exact: true })
    .fill(SECOND_TRANSLATION.year);

  await commitMulti(row, "Translators", SECOND_TRANSLATION.authors);
  await selectEnumOption(row, "Countries", SECOND_TRANSLATION.country);
  await commitMulti(row, "Publishers", SECOND_TRANSLATION.publisher);

  await row.getByRole("button", { name: "Add publication" }).click();
  await submitWorkspace(page, 1);

  // Both translations are in the database, spelling the original the same way.
  await page.goto("/");
  await expectPublicationCount(page, CORPUS_SIZE + 1);
  await expectPublicationRow(page, {
    ...SECOND_TRANSLATION,
    originalTitle: "Dom Casmurro",
    originalAuthors: "Machado de Assis",
  });

  // And the search agrees they are two translations of one book.
  const search = page.getByRole("textbox", { name: "Search publications" });
  await search.fill("Dom Casmurro");
  await expect(
    page.getByRole("row").filter({ hasText: "Gledson" }),
  ).toHaveCount(1);
  await search.clear();

  const details = await openPublicationModal(page, SECOND_TRANSLATION.title);
  await expect(
    details.getByRole("link", { name: "Machado de Assis" }),
  ).toBeVisible();
});

test("a book nobody has entered yet is simply typed", async ({ page }) => {
  await seedCorpus(page);
  await page.goto("/admin/publications/new");

  const row = draftRow(page);
  const originalTitle = row.getByPlaceholder("Original Title", { exact: true });

  await originalTitle.fill("Uma Obra Inédita");

  // Nothing to offer, and the field keeps what it was given.
  await expect(page.getByRole("option")).toHaveCount(0);
  await expect(originalTitle).toHaveValue("Uma Obra Inédita");
});
