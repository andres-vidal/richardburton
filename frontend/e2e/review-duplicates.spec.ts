import { test, expect } from "./fixtures";
import {
  addPublicationRow,
  expectPublicationCount,
  indexTable,
  seedCorpus,
  submitWorkspace,
  CORPUS_SIZE,
} from "./helpers";

// The corpus already holds "Dom Casmurro" (Helen Caldwell, 1953). These three
// are what the composite key cannot catch: the same record typed again with a
// typo, the same translator's work under a later printing's title, and — the
// one that must NOT be offered — another translator's rendering of the book.
const TYPO = {
  title: "Dom Casmuro",
  originalTitle: "Dom Casmurro",
  year: "1953",
  authors: "Helen Caldwell",
  originalAuthors: "Machado de Assis",
  country: "United Kingdom",
  publisher: "W. H. Allen",
};

const RETITLED = {
  title: "The Confessions of a Jealous Man",
  originalTitle: "Dom Casmurro",
  year: "1966",
  authors: "Helen Caldwell",
  originalAuthors: "Machado de Assis",
  country: "Brazil",
  publisher: "Livraria Garnier",
};

const ANOTHER_TRANSLATOR = {
  title: "Dom Casmurro",
  originalTitle: "Dom Casmurro",
  year: "1997",
  authors: "John Gledson",
  originalAuthors: "Machado de Assis",
  country: "United Kingdom",
  publisher: "Bloomsbury",
};

test("an admin reviews the duplicates the composite key cannot catch, merging one cluster and keeping another apart", async ({
  page,
}) => {
  await seedCorpus(page);

  await page.goto("/admin/publications/new");
  await addPublicationRow(page, TYPO);
  await addPublicationRow(page, RETITLED);
  await addPublicationRow(page, ANOTHER_TRANSLATOR);
  await submitWorkspace(page, 3);

  await page.goto("/admin/publications/duplicates");

  // One question, holding the three records of Helen Caldwell's translation —
  // and not John Gledson's, which is a different publication of the same book.
  const queue = page.getByRole("listbox", {
    name: "Clusters of possible duplicates",
  });
  await expect(queue.getByRole("option")).toHaveCount(1);

  await expect(
    page.getByRole("radio", { name: "Keep Dom Casmurro" }),
  ).toBeVisible();
  await expect(
    page.getByRole("radio", { name: "Keep Dom Casmuro" }),
  ).toBeVisible();
  await expect(
    page.getByRole("radio", {
      name: "Keep The Confessions of a Jealous Man",
    }),
  ).toBeVisible();
  // Gledson's is nowhere in the question.
  await expect(page.getByText("Bloomsbury")).toHaveCount(0);

  // Saying they are different records the answer and empties the queue.
  await page.getByRole("button", { name: "Not duplicates" }).click();
  await expect(page.getByText("Kept apart")).toBeVisible();
  await expect(page.getByText("Nothing to reconcile")).toBeVisible();

  // And it stays answered across a reload: the decision outlived the sitting.
  await page.reload();
  await expect(page.getByText("Nothing to reconcile")).toBeVisible();

  // Nothing left the database, since nothing was merged.
  await page.goto("/");
  await expectPublicationCount(page, CORPUS_SIZE + 3);
});

test("merging from the review collapses the cluster and takes it off the queue", async ({
  page,
}) => {
  await seedCorpus(page);

  await page.goto("/admin/publications/new");
  await addPublicationRow(page, TYPO);
  await submitWorkspace(page, 1);

  await page.goto("/admin/publications/duplicates");

  const kept = page.getByRole("radio", { name: "Keep Dom Casmurro" });
  await expect(kept).toBeChecked();

  // Keep the corpus's record and fold the typo into it.
  await page.getByRole("button", { name: "Merge into the one kept" }).click();
  await expect(page.getByText(/Merged 1 publication/)).toBeVisible();
  await expect(page.getByText("Nothing to reconcile")).toBeVisible();

  // One record where there were two, holding both publishers.
  await page.goto("/");
  await expectPublicationCount(page, CORPUS_SIZE);

  const search = page.getByRole("textbox", { name: "Search publications" });
  await search.fill("W. H. Allen");
  const survivor = indexTable(page)
    .getByRole("row")
    .filter({ hasText: "Dom Casmurro" });
  await expect(survivor).toHaveCount(1);

  // The typo is gone from the database and from search.
  await search.fill("Dom Casmuro");
  await expect(
    indexTable(page).getByRole("row").filter({ hasText: "Dom Casmuro," }),
  ).toHaveCount(0);
});
