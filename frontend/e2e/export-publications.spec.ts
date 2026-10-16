import { test, expect } from "./fixtures";
import { downloadCsv, seedCorpus, indexTable } from "./helpers";

test("an admin exports the corpus as a CSV, sources included", async ({
  page,
}) => {
  await seedCorpus(page);
  await page.goto("/");
  // The button disables while the count is 0 — wait for the index to load.
  await expect(indexTable(page).getByText("Barren Lives")).toBeVisible();

  // Download reads the admin-only CSV export, and offers the file it returns.
  const { response, download } = await downloadCsv(page);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toMatch(/csv/);

  // The file is offered under the name the server gave it.
  const named = /filename[^;=\n]*=\"?([^\";\n]*)/.exec(
    response.headers()["content-disposition"],
  );
  expect(download.suggestedFilename()).toBe(named![1]);

  // The file carries the whole corpus, provenance included.
  const csv = await response.text();
  expect(csv).toContain("Gabriela, Clove and Cinnamon");
  expect(csv).toContain("Burton, Isabel. Preface, 1886.");
});
