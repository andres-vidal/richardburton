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
  await expect(page.getByText("Publication updated.")).toBeVisible();
  await expect(
    dialog.getByRole("heading", { name: "Edit publication" }),
  ).toHaveCount(0);
  await expect(
    dialog.getByText("Pontiero, Giovanni. Afterword."),
  ).toBeVisible();
  await expect(
    dialog.getByText("Moser, Benjamin. Why This World, 2009."),
  ).toBeVisible();

  // Only that row changed; its siblings are untouched.
  await page.keyboard.press("Escape");
  const table = indexTable(page);
  await expect(table.getByText("The Hour of the Star (revised)")).toBeVisible();
  await expect(
    table.getByText("The Hour of the Star", { exact: true }),
  ).toHaveCount(0);
  await expect(table.getByText("Barren Lives")).toBeVisible();
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
