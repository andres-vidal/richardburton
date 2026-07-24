import { test, expect } from "./fixtures";
import { seedCorpus, signInAsAdmin, indexTable } from "./helpers";

test("an admin exports the corpus as a CSV, references included", async ({
  page,
}) => {
  await seedCorpus(page);
  await page.goto("/");
  // The button disables while the count is 0 — wait for the index to load.
  await expect(indexTable(page).getByText("Barren Lives")).toBeVisible();

  // Clicking Download drives the admin-only CSV export endpoint.
  const [response] = await Promise.all([
    page.waitForResponse(
      (r) =>
        r.url().includes("files/publications") &&
        r.request().method() === "GET",
    ),
    page.getByRole("button", { name: "Download .csv" }).click(),
  ]);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toMatch(/csv/);

  // The file carries the whole corpus, provenance included.
  const csv = await response.text();
  expect(csv).toContain("Gabriela, Clove and Cinnamon");
  expect(csv).toContain("Burton, Isabel. Preface, 1886.");
});

// One row, 8 semicolon-separated columns in codec order:
// original_authors; year; countries; original_title; title; authors; publishers; references
const CSV_ROW =
  "Machado de Assis;1899;BR;Dom Casmurro;Dom Casmurro (CSV);Helen Caldwell;Noonday Press;A source\n";

test("an admin imports publications from a CSV, references included", async ({
  page,
}) => {
  await signInAsAdmin(page);
  await page.goto("/admin/publications/new");

  await page.locator("#upload-csv").setInputFiles({
    name: "import.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(CSV_ROW),
  });

  // The imported row populates the workspace grid — its fields are editable
  // inputs, so match the row by accessible name — and the references column
  // landed in the row's "Sources" cell.
  const row = indexTable(page).getByRole("row", {
    name: /Dom Casmurro \(CSV\)/,
  });
  await expect(row).toBeVisible();
  await expect(
    row.getByRole("button", { name: "Edit references (1)" }),
  ).toBeVisible();
});

test("a malformed CSV is rejected with an error and imports nothing", async ({
  page,
}) => {
  await signInAsAdmin(page);
  await page.goto("/admin/publications/new");

  // An unterminated quoted field — the csv parser rejects the whole file.
  await page.locator("#upload-csv").setInputFiles({
    name: "broken.csv",
    mimeType: "text/csv",
    buffer: Buffer.from('Machado de Assis;1899;BR;Dom;"unterminated\n'),
  });

  await expect(
    page.getByText("Could not parse publications from the provided file"),
  ).toBeVisible();
  // Nothing was imported — the grid still holds only its header and draft row.
  await expect(indexTable(page).getByRole("row")).toHaveCount(2);
});
