import { test, expect } from "./fixtures";
import {
  signInAsAdmin,
  seedCorpus,
  addPublicationRow,
  submitWorkspace,
  indexTable,
  type PublicationInput,
} from "./helpers";

const VALID: PublicationInput = {
  title: "The Posthumous Memoirs (E2E)",
  originalTitle: "Memórias Póstumas de Brás Cubas",
  year: "1997",
  authors: "Gregory Rabassa",
  originalAuthors: "Machado de Assis",
  country: "Brazil",
  publisher: "Oxford University Press",
};

// Missing its publisher — the server-side validation flags `required`.
const INCOMPLETE = { ...VALID, title: "Incomplete (E2E)" };

// An exact copy of a corpus row — the server-side validation flags `conflict`.
const DUPLICATE: PublicationInput = {
  title: "Dom Casmurro",
  originalTitle: "Dom Casmurro",
  year: "1953",
  authors: "Helen Caldwell",
  originalAuthors: "Machado de Assis",
  country: "United States",
  publisher: "Noonday Press",
};

test("an invalid row blocks submission until it is fixed", async ({ page }) => {
  await signInAsAdmin(page);
  await page.goto("/admin/publications/new");
  const table = indexTable(page);

  // Commit a row without its publisher: it validates as invalid, the error
  // counter appears, and Submit stays disabled.
  await addPublicationRow(page, { ...INCOMPLETE, publisher: "" });
  await expect(page.getByLabel("1 invalid publications")).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit" })).toBeDisabled();

  // Filling the missing field revalidates the row and unblocks the submit.
  const row = table.getByRole("row", { name: /Incomplete \(E2E\)/ });
  const input = row.getByPlaceholder("Publishers", { exact: true });
  await input.click();
  await input.pressSequentially("Oxford University Press");
  await input.press("Enter");
  await page.keyboard.press("Tab");

  await expect(page.getByLabel("All publications are valid")).toBeVisible();
  await submitWorkspace(page, 1);
});

test("a duplicate of an existing publication is flagged as a conflict", async ({
  page,
}) => {
  await seedCorpus(page);
  await page.goto("/admin/publications/new");
  const table = indexTable(page);

  // One genuinely new publication, then an exact duplicate of a stored one (last,
  // so its error tooltip doesn't hover over the draft row while it's being filled).
  await addPublicationRow(page, VALID);
  await addPublicationRow(page, DUPLICATE);

  // The duplicate is flagged against the database before anything is submitted.
  await expect(page.getByLabel("1 invalid publications")).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit" })).toBeDisabled();

  // Drop the conflicting row. Row-selection clicks must land on the signal cell
  // (field cells swallow them), and off its center — the centered error icon
  // opens a hover tooltip that would swallow the click instead.
  const duplicate = table.getByRole("row", { name: /Dom Casmurro/ });
  await duplicate
    .getByRole("cell")
    .first()
    .click({ position: { x: 4, y: 4 } });
  await page.getByRole("button", { name: "Delete 1" }).click();

  await expect(page.getByLabel("All publications are valid")).toBeVisible();
  await submitWorkspace(page, 1);
});
