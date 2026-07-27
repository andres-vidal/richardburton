import { test, expect } from "./fixtures";
import {
  seedCorpus,
  openPublicationModal,
  indexTable,
  addPublicationRow,
  submitWorkspace,
} from "./helpers";

test("an admin edits a publication's title and references in a corpus", async ({
  page,
}) => {
  await seedCorpus(page);
  await page.goto("/");

  // Open one publication's detail modal and switch to the (admin-only) edit form.
  const dialog = await openPublicationModal(page, "The Hour of the Star");
  await dialog.getByRole("button", { name: "Edit" }).click();
  await expect(
    dialog.getByRole("heading", { name: "Edit publication" }),
  ).toBeVisible();

  // Change the title (validation runs on blur).
  const title = dialog.getByRole("textbox", { name: "Title", exact: true });
  await title.fill("The Hour of the Star (revised)");
  await title.blur();

  // The corpus reference is already listed; add a second source alongside it.
  await expect(
    dialog.getByRole("textbox", { name: "Reference 1" }),
  ).toHaveValue("Pontiero, Giovanni. Afterword.");
  await dialog.getByRole("button", { name: "Add reference" }).click();
  await dialog
    .getByRole("textbox", { name: "Reference 2" })
    .fill("Moser, Benjamin. Why This World, 2009.");

  const save = dialog.getByRole("button", { name: "Save" });
  await expect(save).toBeEnabled();
  await save.click();

  // Success toast, and the modal drops back to the read view with both sources.
  // The confirmation names the record it saved, not just that a save happened.
  // One assertion, not two: confirmations dismiss themselves after a few
  // seconds, so a second wait can straddle the dismissal.
  // A CSS locator, not getByRole: the open dialog aria-hides the rest of the
  // document, so the portalled stack is out of the accessibility tree while the
  // modal is up.
  await expect(
    page.locator("section[aria-label='Notifications']"),
  ).toContainText(
    // No quote characters in the pattern — the copy wraps the title in curly
    // quotes, which are easy to get wrong in a regex and prove nothing here.
    // `[\s\S]` rather than the `s` flag: tsconfig targets es5, where dotAll is
    // a compile error.
    /Publication updated[\s\S]*The Hour of the Star \(revised\)[\s\S]*is saved/,
  );
  await expect(
    dialog.getByRole("heading", { name: "Edit publication" }),
  ).toHaveCount(0);
  // `exact`: the history section is in the document from the start now, and its
  // diff names the same reference with a "+ " in front.
  await expect(
    dialog.getByText("Pontiero, Giovanni. Afterword.", { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByText("Moser, Benjamin. Why This World, 2009.", {
      exact: true,
    }),
  ).toBeVisible();

  // The edit landed in the history log: expanding the (admin-only) History
  // section shows the import and the update, actor-attributed, with the
  // update's field-level diff.
  await dialog.getByText("History", { exact: true }).click();
  await expect(dialog.getByText("created")).toBeVisible();
  await expect(dialog.getByText("updated")).toBeVisible();
  await expect(dialog.getByText("by dev-admin@localhost")).toHaveCount(2);
  await expect(
    dialog.getByText(
      "Title: The Hour of the Star → The Hour of the Star (revised)",
    ),
  ).toBeVisible();
  // The diff names the exact reference that was added.
  await expect(
    dialog.getByText("+ Moser, Benjamin. Why This World, 2009."),
  ).toBeVisible();

  // Only that row changed; its siblings are untouched.
  await page.keyboard.press("Escape");
  const table = indexTable(page);
  await expect(table.getByText("The Hour of the Star (revised)")).toBeVisible();
  await expect(
    table.getByText("The Hour of the Star", { exact: true }),
  ).toHaveCount(0);
  await expect(table.getByText("Barren Lives")).toBeVisible();

  // A second edit touches only the year — so the first edit's fields are
  // untouched and that edit stays undoable from the history feed.
  const dialogAgain = await openPublicationModal(
    page,
    "The Hour of the Star (revised)",
  );
  await dialogAgain.getByRole("button", { name: "Edit" }).click();
  const year = dialogAgain.getByRole("textbox", { name: "Year", exact: true });
  await year.fill("1987");
  await year.blur();
  await dialogAgain.getByRole("button", { name: "Save" }).click();
  await expect(
    dialogAgain.getByRole("heading", { name: "Edit publication" }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");

  // Undoing the OLDER update reverts exactly its fields (title, references) —
  // the later year change survives. Reconcilable undo, not last-write undo.
  await page.goto("/admin/publications/history");
  const updated = page.locator('li[data-action="updated"]');
  await expect(updated).toHaveCount(2);
  await updated.last().getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText("Change undone")).toBeVisible();

  await page.goto("/");
  const row = indexTable(page)
    .getByRole("row")
    .filter({ hasText: "The Hour of the Star" })
    .first();
  await expect(
    row.getByText("The Hour of the Star", { exact: true }),
  ).toBeVisible();
  await expect(row.getByText("1987", { exact: true })).toBeVisible();
});

test("editing a publication into a copy of another is rejected as a conflict", async ({
  page,
}) => {
  await seedCorpus(page);

  // A sibling that matches "Dom Casmurro" in everything but the title, so a
  // single title edit is all it takes to collide.
  await page.goto("/admin/publications/new");
  await addPublicationRow(page, {
    title: "Dom Casmurro (copy)",
    originalTitle: "Dom Casmurro",
    year: "1953",
    authors: "Helen Caldwell",
    originalAuthors: "Machado de Assis",
    country: "United States",
    publisher: "Noonday Press",
  });
  await submitWorkspace(page, 1);

  await page.goto("/");
  const dialog = await openPublicationModal(page, "Dom Casmurro (copy)");
  await dialog.getByRole("button", { name: "Edit" }).click();

  const title = dialog.getByRole("textbox", { name: "Title", exact: true });
  await title.fill("Dom Casmurro");
  await title.blur();

  // The blur validation flags the collision with the stored publication and
  // keeps Save disabled — the edit cannot be committed.
  await expect(
    dialog.getByText("A publication with this data already exists"),
  ).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Save" })).toBeDisabled();
});

test("an admin arrives by link and corrects the publication on its own page", async ({
  page,
}) => {
  await seedCorpus(page);
  await page.goto("/");

  // Following a row *is* going to the record's address — the overlay is that
  // address intercepted. Arriving at it cold gives the page instead.
  await openPublicationModal(page, "Barren Lives");
  const address = new URL(page.url()).pathname;
  expect(address).toMatch(/^\/publications\/\d+$/);
  await page.goto(address);

  // The page offers what the overlay offers, with no catalogue behind it.
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("Iraçéma the Honey-Lips")).toHaveCount(0);

  await page.getByRole("button", { name: "Edit" }).click();
  const year = page.getByRole("textbox", { name: "Year", exact: true });
  await year.fill("1972");
  await year.blur();
  await page.getByRole("button", { name: "Save" }).click();

  // The body, the heading and the breadcrumb agree after the save: the page
  // re-reads the record rather than patching what it already drew.
  await expect(
    page.getByRole("heading", { name: "Edit publication" }),
  ).toHaveCount(0);
  await expect(
    page.getByText(/in 1972 by University of Texas Press/),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Breadcrumb" }),
  ).toContainText("Barren Lives");

  // The mutation log is here too, naming the change just made.
  await page.getByText("History", { exact: true }).click();
  await expect(page.getByText("Year: 1965 → 1972")).toBeVisible();

  // Deleting from a page that shows only this record leaves for the index,
  // since there is nothing left to show.
  await page.getByRole("button", { name: "Delete" }).click();
  await page
    .getByRole("dialog", { name: "Delete this publication?" })
    .getByRole("button", { name: "Delete" })
    .click();

  const table = indexTable(page);
  await expect(table.getByText("Dom Casmurro").first()).toBeVisible();
  await expect(table.getByText("Barren Lives")).toHaveCount(0);

  // The link now says the record is gone rather than rendering an empty page.
  const response = await page.goto(address);
  expect(response?.status()).toBe(404);
});
