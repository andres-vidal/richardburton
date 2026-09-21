import { test, expect } from "./fixtures";
import { seedCorpus, submitWorkspace, indexTable, CSV_HEADER } from "./helpers";

/** A second batch, in which two of the corpus's names are spelt a second way. */
const SECOND_BATCH =
  [
    CSV_HEADER,
    `Esau and Jacob,1965,US,Noonday press,Helen Caldwel,Esaú e Jacó,Machado de Assis,`,
    `Counselor Ayres' Memorial,1972,US,Noonday press,Helen Caldwel,Memorial de Aires,Machado de Assis,`,
  ].join("\n") + "\n";

test("the workspace names the spellings a batch would add, and corrects them in every row at once", async ({
  page,
}) => {
  // The corpus establishes the spellings: Helen Caldwell translating for
  // Noonday Press and the rest.
  await seedCorpus(page);

  await page.goto("/admin/publications/new");
  await page.locator("#upload-csv").setInputFiles({
    name: "second-batch.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(SECOND_BATCH),
  });

  await expect(
    indexTable(page).getByRole("row", { name: /Esau and Jacob/ }),
  ).toBeVisible();

  // Both rows carry both misspellings, so the batch has two doubtful names.
  const control = page.getByRole("button", {
    name: "2 names may be misspelt",
  });
  await expect(control).toBeVisible({ timeout: 15_000 });
  await control.click();

  const panel = page.getByRole("dialog", { name: "Names in this batch" });
  await expect(panel).toContainText("Helen Caldwel");
  await expect(panel).toContainText("2 rows");

  // A name the database already holds is listed, and not raised as doubtful.
  await expect(panel).toContainText("Machado de Assis");

  // The established spelling comes with what already rests on it.
  await panel
    .getByRole("button", { name: /^Helen Caldwell \d+ publications?$/ })
    .click();
  await panel
    .getByRole("button", { name: /^Noonday Press \d+ publications?$/ })
    .click();

  // Nothing doubtful is left, so the control goes back to counting.
  await expect(
    page.getByRole("button", { name: /may be misspelt/ }),
  ).toHaveCount(0);

  await page.keyboard.press("Escape");

  // The correction reached the rows themselves, not just the panel.
  await expect(
    indexTable(page).getByRole("row", { name: /Helen Caldwell/ }),
  ).toHaveCount(2);

  await submitWorkspace(page, 2);

  // And the database gained no second spelling of either name.
  await page.goto("/admin/vocabulary");
  await expect(
    page.getByLabel("Name, currently Noonday press", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByLabel("Name, currently Noonday Press", { exact: true }),
  ).toBeVisible();
});

test("a batch of names the database already holds raises nothing", async ({
  page,
}) => {
  await seedCorpus(page);

  await page.goto("/admin/publications/new");
  await page.locator("#upload-csv").setInputFiles({
    name: "same-names.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      [
        CSV_HEADER,
        `Esau and Jacob,1965,US,Noonday Press,Helen Caldwell,Esaú e Jacó,Machado de Assis,`,
      ].join("\n") + "\n",
    ),
  });

  await expect(
    indexTable(page).getByRole("row", { name: /Esau and Jacob/ }),
  ).toBeVisible();

  // Counting, not warning: two names of the row plus its publisher.
  await expect(page.getByRole("button", { name: "3 names" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(
    page.getByRole("button", { name: /may be misspelt/ }),
  ).toHaveCount(0);
});

test("the names view marks which of the names it holds may be the same name twice", async ({
  page,
}) => {
  await seedCorpus(page);

  // A second batch that does add a misspelling, so the database now holds both.
  await page.goto("/admin/publications/new");
  await page.locator("#upload-csv").setInputFiles({
    name: "second-batch.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(SECOND_BATCH),
  });

  await expect(
    indexTable(page).getByRole("row", { name: /Esau and Jacob/ }),
  ).toBeVisible();
  await submitWorkspace(page, 2);

  await page.goto("/admin/vocabulary");

  // Both spellings of the publisher are here, and each points at the other.
  const doubtful = page.getByRole("button", { name: /may be duplicates$/ });
  await expect(doubtful).toBeVisible();
  await doubtful.click();

  const names = page.getByRole("list", { name: "Publishers" });
  await expect(names.getByRole("listitem")).toHaveCount(2);

  // Taking the offered spelling writes it into the field rather than renaming.
  await names
    .getByRole("button", { name: /^Noonday Press \d+ publications?$/ })
    .click();

  const stray = page.getByLabel("Name, currently Noonday press", {
    exact: true,
  });
  await expect(stray).toHaveValue("Noonday Press");

  // The person's own press is what folds them, and only after saying so.
  await stray.press("Enter");
  await page
    .getByRole("dialog", { name: "Fold these two together?" })
    .getByRole("button", { name: "Fold them" })
    .click();

  await expect(
    page.getByText("Noonday press folded into Noonday Press"),
  ).toBeVisible();

  await expect(
    page.getByRole("button", { name: /publishers.*may be duplicates$/ }),
  ).toHaveCount(0);
});
