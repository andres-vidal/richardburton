import { test, expect } from "./fixtures";
import { seedCorpus, CORPUS_UNREFERENCED } from "./helpers";

test("the wizard queues only unreferenced publications and sources one", async ({
  page,
}) => {
  // Seven publications; three already carry a reference, so four are queued.
  await seedCorpus(page);

  await page.goto("/admin/publications/references");

  const queue = page.getByRole("listbox", {
    name: "Publications missing references",
  });
  await expect(queue.getByRole("option")).toHaveCount(CORPUS_UNREFERENCED);
  await expect(page.getByText(/^1 \/ 4$/)).toBeVisible();
  // The three already-sourced works are absent from the queue.
  await expect(
    queue.getByRole("option", { name: /Iraçéma the Honey-Lips/ }),
  ).toHaveCount(0);

  // Mid-queue the action promises to advance…
  await expect(
    page.getByRole("button", { name: "Save & next", exact: true }),
  ).toBeVisible();

  // …but on the last queued publication there is no next, so it's just "Save".
  await queue.getByRole("option", { name: "Barren Lives" }).click();
  const save = page.getByRole("button", { name: "Save", exact: true });
  await expect(save).toBeVisible();

  await page.getByRole("button", { name: "Add reference" }).click();
  await page
    .getByRole("textbox", { name: "Reference 1" })
    .fill("Dimmick, Ralph. Translator's note, 1965.");

  // Drafting alone does not mark it sourced — only a save does.
  await expect(
    queue.getByRole("option", { name: "Barren Lives", exact: true }),
  ).toBeVisible();

  await save.click();

  // It flips to sourced (green dot / "— sourced"), which also decrements the count.
  await expect(
    queue.getByRole("option", { name: /Barren Lives.*sourced/ }),
  ).toBeVisible();
});

test("skipping a publication discards its edits and moves on", async ({
  page,
}) => {
  await seedCorpus(page);
  await page.goto("/admin/publications/references");

  const queue = page.getByRole("listbox", {
    name: "Publications missing references",
  });
  await expect(page.getByText(/^1 \/ 4$/)).toBeVisible();

  // Draft a reference but skip instead of saving.
  await page.getByRole("button", { name: "Add reference" }).click();
  await page
    .getByRole("textbox", { name: "Reference 1" })
    .fill("A draft that should not survive the skip");
  await page.getByRole("button", { name: "Skip" }).click();

  // The wizard advanced, and the skipped publication stayed unsourced.
  await expect(page.getByText(/^2 \/ 4$/)).toBeVisible();
  await expect(
    queue.getByRole("option", { name: "Dom Casmurro", exact: true }),
  ).toBeVisible();

  // Coming back to it, the drafted reference is gone.
  await queue
    .getByRole("option", { name: "Dom Casmurro", exact: true })
    .click();
  await expect(page.getByText("No references yet.")).toBeVisible();
});
