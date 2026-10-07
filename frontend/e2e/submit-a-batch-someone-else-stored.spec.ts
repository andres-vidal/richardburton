import { test, expect } from "./fixtures";
import {
  CSV_HEADER,
  IMPORT_CSV,
  expectPublicationCount,
  indexTable,
  openDocument,
  selectRows,
  signInAsAdmin,
  signInAsContributor,
  submitWorkspace,
  uploadCsv,
} from "./helpers";

/** Dom Casmurro, as `IMPORT_CSV` lists it. */
const DOM_CASMURRO_CSV =
  [
    CSV_HEADER,
    `Dom Casmurro,1953,US,Noonday Press,Helen Caldwell,Dom Casmurro,Machado de Assis,`,
  ].join("\n") + "\n";

test("a submit refused because someone else stored a row keeps every row, and marks the one in conflict", async ({
  page,
  colleague,
}) => {
  // The admin prepares Dom Casmurro and Iracema, and both are checked.
  await signInAsAdmin(page);
  await openDocument(page, "Mine");
  await uploadCsv(page, IMPORT_CSV, "mine.csv");
  const mine = indexTable(page);
  await expect(mine.getByRole("row", { name: /Iracema/ })).toBeVisible();

  const submit = page.getByRole("button", { name: "Submit" });
  await expect(submit).toBeEnabled({ timeout: 30_000 });

  // Before the admin submits, a colleague stores Dom Casmurro from a document
  // of their own.
  await signInAsContributor(colleague);
  await openDocument(colleague, "Theirs");
  await uploadCsv(colleague, DOM_CASMURRO_CSV, "theirs.csv");
  await submitWorkspace(colleague, 1);

  // The admin's submit is refused. Both rows stay, and the rows are checked
  // again, which marks Dom Casmurro and keeps Submit disabled.
  await submit.click();
  await expect(
    page.getByText("A publication with this data already exists"),
  ).toBeVisible();
  await expect(mine.getByRole("row", { name: /Dom Casmurro/ })).toBeVisible();
  await expect(mine.getByRole("row", { name: /Iracema/ })).toBeVisible();
  await expect(page.getByLabel("1 invalid publication")).toBeVisible({
    timeout: 15_000,
  });
  await expect(submit).toBeDisabled();

  // Removing the row the colleague stored lets Iracema through.
  await selectRows(page, ["Dom Casmurro"]);
  await page.getByRole("button", { name: "Remove 1", exact: true }).click();
  await expect(mine.getByRole("row", { name: /Dom Casmurro/ })).toHaveCount(0);
  await submitWorkspace(page, 1);

  await page.goto("/");
  await expectPublicationCount(page, 2);
});
