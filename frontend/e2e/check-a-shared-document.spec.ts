import { test, expect } from "./fixtures";
import {
  CSV_HEADER,
  IMPORT_CSV,
  indexTable,
  moveSelectedRows,
  openDocument,
  seedCorpus,
  signInAsAdmin,
  uploadCsv,
} from "./helpers";

test("an edit that breaks a row is invalid for everyone, and undoing it makes the row valid for everyone", async ({
  page,
  colleague,
}) => {
  await signInAsAdmin(page);
  await openDocument(page, "Checked together");
  const address = page.url();

  await uploadCsv(page, IMPORT_CSV, "checked.csv");
  const mine = indexTable(page);
  await expect(mine.getByRole("row", { name: /Iracema/ })).toBeVisible();
  // The colleague reads the rows from the server, so wait until the upload is
  // saved.
  await expect(page.getByRole("status", { name: "Saved" })).toBeVisible();

  await signInAsAdmin(colleague);
  await colleague.goto(address);
  await expect(
    indexTable(colleague).getByRole("row", { name: /Iracema/ }),
  ).toBeVisible();
  await expect(colleague.getByLabel("All publications are valid")).toBeVisible({
    timeout: 15_000,
  });

  // The admin clears Iracema's title. The admin's page validates the edit and
  // stores the result in the document, so the colleague sees the row as
  // invalid without editing anything.
  const title = mine.getByRole("textbox", { name: "Title" }).nth(1);
  await title.fill("");
  await title.blur();

  await expect(page.getByLabel("1 invalid publication")).toBeVisible({
    timeout: 15_000,
  });
  await expect(colleague.getByLabel("1 invalid publication")).toBeVisible({
    timeout: 15_000,
  });
  await expect(
    colleague.getByRole("button", { name: "Submit" }),
  ).toBeDisabled();

  // Undo puts the title back. The undo is checked like any other edit, so the
  // row is valid again for both.
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(mine.getByRole("row", { name: /Iracema/ })).toBeVisible();

  await expect(page.getByLabel("All publications are valid")).toBeVisible({
    timeout: 15_000,
  });
  await expect(colleague.getByLabel("All publications are valid")).toBeVisible({
    timeout: 15_000,
  });
  await expect(colleague.getByRole("button", { name: "Submit" })).toBeEnabled();
});

test("a row edited into a look-alike of a stored record is flagged for everyone", async ({
  page,
  colleague,
}) => {
  await seedCorpus(page);
  await openDocument(page, "Second printing");
  const address = page.url();

  // The corpus holds "Epitaph of a Small Winner" from 1952. This row has
  // another year, so it is another printing and resembles nothing.
  await uploadCsv(
    page,
    [
      CSV_HEADER,
      `Epitaph of a Small Winner,1967,US,Noonday Press,William Grossman,Memórias Póstumas,Machado de Assis,`,
    ].join("\n") + "\n",
    "printing.csv",
  );
  const mine = indexTable(page);
  const row = mine.getByRole("row", { name: /Epitaph of a Small Winner/ });
  await expect(row).toBeVisible();
  await expect(page.getByRole("status", { name: "Saved" })).toBeVisible();

  await signInAsAdmin(colleague);
  await colleague.goto(address);
  await expect(
    indexTable(colleague).getByRole("row", {
      name: /Epitaph of a Small Winner/,
    }),
  ).toBeVisible();

  const counter = (on: typeof page) =>
    on.getByRole("button", {
      name: "1 row looks like a publication already known",
    });
  await expect(counter(colleague)).toHaveCount(0);

  // The admin corrects the year to the stored record's. The row now resembles
  // it, and the colleague's counter shows it too.
  const year = row.getByPlaceholder("Year", { exact: true });
  await year.fill("1952");
  await year.blur();

  await expect(counter(page)).toBeVisible({ timeout: 15_000 });
  await expect(counter(colleague)).toBeVisible({ timeout: 15_000 });

  // The colleague opens the review from the counter and sees the stored record.
  await counter(colleague).click();
  const review = colleague.getByRole("dialog", {
    name: "Possible duplicates in this import",
  });
  await expect(
    review.getByText("Resembles one record already in the database."),
  ).toBeVisible();
});

test("a row moved out takes its error with it, and is checked again in the document it moves to", async ({
  page,
  colleague,
  colleagueContext,
}) => {
  await signInAsAdmin(page);
  await openDocument(page, "Batch");
  const address = page.url();

  // Macunaíma has no publisher, so it holds the batch back.
  await uploadCsv(
    page,
    IMPORT_CSV +
      `Macunaíma,1984,US,,E. A. Goodland,Macunaíma,Mário de Andrade,\n`,
    "batch.csv",
  );
  const mine = indexTable(page);
  await expect(page.getByLabel("1 invalid publication")).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole("status", { name: "Saved" })).toBeVisible();

  // The colleague starts a document of their own, and also has the batch open
  // in another tab, where the row reads as invalid too.
  await signInAsAdmin(colleague);
  await openDocument(colleague, "Held back");
  const held = indexTable(colleague);

  const batch = await colleagueContext.newPage();
  await batch.goto(address);
  await expect(
    indexTable(batch).getByRole("row", { name: /Macunaíma/ }),
  ).toBeVisible();
  await expect(batch.getByLabel("1 invalid publication")).toBeVisible({
    timeout: 15_000,
  });
  await expect(batch.getByRole("button", { name: "Submit" })).toBeDisabled();

  // The admin moves Macunaíma into the colleague's document.
  await mine
    .getByRole("row", { name: /Macunaíma/ })
    .getByRole("cell")
    .first()
    .click({ position: { x: 4, y: 4 } });
  await moveSelectedRows(page, 1, { existing: "Held back" });

  // The row's error leaves the batch with the row, so the batch is valid for
  // both.
  await expect(page.getByLabel("All publications are valid")).toBeVisible({
    timeout: 15_000,
  });
  await expect(batch.getByLabel("All publications are valid")).toBeVisible({
    timeout: 15_000,
  });
  await expect(batch.getByRole("button", { name: "Submit" })).toBeEnabled();

  // The row arrives in the colleague's document without a result. The
  // colleague's page checks it, since the admin's page does not have that
  // document open.
  await expect(held.getByRole("row", { name: /Macunaíma/ })).toBeVisible({
    timeout: 30_000,
  });
  await expect(colleague.getByLabel("1 invalid publication")).toBeVisible({
    timeout: 15_000,
  });
  await expect(
    colleague.getByRole("button", { name: "Submit" }),
  ).toBeDisabled();
});
