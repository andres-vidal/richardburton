import { test, expect } from "./fixtures";
import {
  seedCorpus,
  submitWorkspace,
  indexTable,
  openDocument,
  CSV_HEADER,
} from "./helpers";

/**
 * A batch that misspells two of the corpus's names, as "Noonday press" and
 * "Helen Caldwel".
 */
const SECOND_BATCH =
  [
    CSV_HEADER,
    `Esau and Jacob,1965,US,Noonday press,Helen Caldwel,Esaú e Jacó,Machado de Assis,`,
    `Counselor Ayres' Memorial,1972,US,Noonday press,Helen Caldwel,Memorial de Aires,Machado de Assis,`,
  ].join("\n") + "\n";

test("the workspace names the spellings a batch would add, and corrects them in every row at once", async ({
  page,
}) => {
  // The corpus stores the correct spellings, including Helen Caldwell and
  // Noonday Press.
  await seedCorpus(page);

  await openDocument(page);
  await page.locator("#upload-csv").setInputFiles({
    name: "second-batch.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(SECOND_BATCH),
  });

  await expect(
    indexTable(page).getByRole("row", { name: /Esau and Jacob/ }),
  ).toBeVisible();

  // Both rows have both misspellings, so two names may be misspelt.
  const control = page.getByRole("button", {
    name: "2 names may be misspelt",
  });
  await expect(control).toBeVisible({ timeout: 15_000 });
  await control.click();

  const panel = page.getByRole("dialog", { name: "Names in this batch" });
  await expect(panel).toContainText("Helen Caldwel");
  await expect(panel).toContainText("2 rows");

  // A name the database already has is listed but not marked.
  await expect(panel).toContainText("Machado de Assis");

  // Take the stored spelling of both names. Each button shows the name's
  // publication count.
  await panel
    .getByRole("button", { name: /^Helen Caldwell \d+ publications?$/ })
    .click();
  await panel
    .getByRole("button", { name: /^Noonday Press \d+ publications?$/ })
    .click();

  // No name is marked any more, so the button shows the plain name count.
  await expect(
    page.getByRole("button", { name: /may be misspelt/ }),
  ).toHaveCount(0);

  await page.keyboard.press("Escape");

  // The correction changed the rows in the table, not only the dialog.
  await expect(
    indexTable(page).getByRole("row", { name: /Helen Caldwell/ }),
  ).toHaveCount(2);

  await submitWorkspace(page, 2);

  // After the submit, the database has no second spelling of the publisher.
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

  await openDocument(page);
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

  // The button shows a count, not a warning: the translator, the original
  // author and the publisher.
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

  // Submit the misspelt batch, so the database has both spellings.
  await openDocument(page);
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

  // Both spellings of the publisher are listed and marked as resembling each
  // other.
  const doubtful = page.getByRole("button", { name: /may be duplicates$/ });
  await expect(doubtful).toBeVisible();
  await doubtful.click();

  const names = page.getByRole("list", { name: "Publishers" });
  await expect(names.getByRole("listitem")).toHaveCount(2);

  // Clicking the offered spelling writes it into the field without renaming.
  await names
    .getByRole("button", { name: /^Noonday Press \d+ publications?$/ })
    .click();

  const stray = page.getByLabel("Name, currently Noonday press", {
    exact: true,
  });
  await expect(stray).toHaveValue("Noonday Press");

  // Pressing Enter sends the rename, and the fold happens once it is confirmed.
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
