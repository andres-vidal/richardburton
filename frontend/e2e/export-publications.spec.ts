import { test, expect } from "./fixtures";
import { seedCorpus, indexTable } from "./helpers";

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
