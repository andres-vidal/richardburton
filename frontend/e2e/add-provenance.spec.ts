import { test, expect } from "./fixtures";
import { seedCorpus, openPublicationModal, CORPUS_UNSOURCED } from "./helpers";

test("the wizard queues only unsourced publications and sources one in both languages, side by side", async ({
  page,
}) => {
  // Seven publications; three already carry a source, so four are queued.
  await seedCorpus(page);

  await page.goto("/admin/publications/sources");

  const queue = page.getByRole("listbox", {
    name: "Publications missing sources",
  });
  await expect(queue.getByRole("option")).toHaveCount(CORPUS_UNSOURCED);
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

  // The page is wide enough to show the lists of both languages side by
  // side, with no tabs, so both are written without switching between them.
  await expect(page.getByRole("tab")).toHaveCount(0);
  const english = page.getByRole("tabpanel", { name: "English" });
  const portuguese = page.getByRole("tabpanel", { name: "Português" });
  await expect(english.getByText("No sources yet.")).toBeVisible();
  await expect(portuguese.getByText("No sources yet.")).toBeVisible();

  await english.getByRole("button", { name: "Add source" }).click();
  await english
    .getByRole("textbox", { name: "Source 1" })
    .fill("Dimmick, Ralph. Translator's note, 1965.");
  await portuguese.getByRole("button", { name: "Add source" }).click();
  await portuguese
    .getByRole("textbox", { name: "Source 1" })
    .fill("Dimmick, Ralph. Nota do tradutor, 1965.");
  await portuguese.getByRole("button", { name: "Add source" }).click();
  await portuguese
    .getByRole("textbox", { name: "Source 2" })
    .fill("Ramos, Graciliano. Vidas Secas. José Olympio, 1938.");
  // Each list keeps its own sources while the other is written.
  await expect(english.getByRole("textbox")).toHaveCount(1);
  await expect(portuguese.getByRole("textbox")).toHaveCount(2);

  // Drafting alone does not mark it sourced — only a save does.
  await expect(
    queue.getByRole("option", { name: "Barren Lives", exact: true }),
  ).toBeVisible();

  await save.click();

  // It flips to sourced (green dot / "— sourced"), which also decrements the count.
  await expect(
    queue.getByRole("option", { name: /Barren Lives.*sourced/ }),
  ).toBeVisible();

  // Each reader is shown the list of their own language.
  await page.goto("/");
  const dialog = await openPublicationModal(page, "Barren Lives");
  await expect(
    dialog.getByRole("region", { name: "Sources" }).locator("li"),
  ).toHaveText(["Dimmick, Ralph. Translator's note, 1965."]);

  await page.goto(new URL(page.url()).pathname.replace(/^\/(en\/)?/, "/pt/"));
  await expect(
    page.getByRole("region", { name: "Fontes" }).locator("li"),
  ).toHaveText([
    "Dimmick, Ralph. Nota do tradutor, 1965.",
    "Ramos, Graciliano. Vidas Secas. José Olympio, 1938.",
  ]);
});

test("skipping a publication discards its edits and moves on", async ({
  page,
}) => {
  await seedCorpus(page);
  await page.goto("/admin/publications/sources");

  const queue = page.getByRole("listbox", {
    name: "Publications missing sources",
  });
  await expect(page.getByText(/^1 \/ 4$/)).toBeVisible();

  // Draft a source but skip instead of saving.
  const english = page.getByRole("tabpanel", { name: "English" });
  await english.getByRole("button", { name: "Add source" }).click();
  await english
    .getByRole("textbox", { name: "Source 1" })
    .fill("A draft that should not survive the skip");
  await page.getByRole("button", { name: "Skip" }).click();

  // The wizard advanced, and the skipped publication stayed unsourced.
  await expect(page.getByText(/^2 \/ 4$/)).toBeVisible();
  await expect(
    queue.getByRole("option", { name: "Dom Casmurro", exact: true }),
  ).toBeVisible();

  // Coming back to it, the drafted source is gone.
  await queue
    .getByRole("option", { name: "Dom Casmurro", exact: true })
    .click();
  await expect(
    page
      .getByRole("tabpanel", { name: "English" })
      .getByText("No sources yet."),
  ).toBeVisible();
});
