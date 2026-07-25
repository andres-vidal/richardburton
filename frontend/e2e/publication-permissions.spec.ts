import { test, expect } from "./fixtures";
import { seedCorpus, signOut, openPublicationModal } from "./helpers";

test("a signed-out reader sees publication details read-only, references included", async ({
  page,
}) => {
  await seedCorpus(page);
  // Sign out from the home footer (the admin workspace footer has no session controls).
  await page.goto("/");
  await signOut(page);

  const dialog = await openPublicationModal(page, "The Hour of the Star");
  // Provenance is public: the reference shows in the read view…
  await expect(
    dialog.getByText("Pontiero, Giovanni. Afterword."),
  ).toBeVisible();
  // …but editing is admin-only.
  await expect(dialog.getByRole("button", { name: "Edit" })).toHaveCount(0);
});

test("a signed-out visitor cannot reach the admin workspace", async ({
  page,
}) => {
  await page.goto("/admin/publications/new");

  // The guard bounces the visitor back to the public index.
  await expect(page).toHaveURL("/");
  await expect(
    page.getByRole("heading", { name: "Add publications" }),
  ).toHaveCount(0);
});
