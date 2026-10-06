import { test, expect } from "./fixtures";
import {
  CSV_HEADER,
  expectPublicationCount,
  indexTable,
  openDocument,
  selectRows,
  signInAsAdmin,
  signInAsContributor,
  submitWorkspace,
  uploadCsv,
} from "./helpers";

/** A batch of four new publications. */
const BATCH_CSV =
  [
    CSV_HEADER,
    `The Devil to Pay in the Backlands,1963,US,Knopf,James L. Taylor,Grande Sertão: Veredas,João Guimarães Rosa,`,
    `Macunaíma,1984,US,Random House,E. A. Goodland,Macunaíma,Mário de Andrade,`,
    `The Hour of the Star,1986,US,Carcanet,Giovanni Pontiero,A Hora da Estrela,Clarice Lispector,`,
    `The Passion According to G.H.,1988,US,University of Minnesota Press,Ronald W. Sousa,A Paixão Segundo G.H.,Clarice Lispector,`,
  ].join("\n") + "\n";

test("rows removed from a shared document disappear for everyone, Undo brings them back, and the rest is imported", async ({
  page,
  colleague,
}) => {
  await signInAsAdmin(page);
  await openDocument(page, "Clean-up");
  const address = page.url();

  await uploadCsv(page, BATCH_CSV, "clean-up.csv");
  const mine = indexTable(page);
  await expect(mine.getByRole("row", { name: /Macunaíma/ })).toBeVisible();
  // The colleague reads the rows from the server, so wait until they are saved.
  await expect(page.getByRole("status", { name: "Saved" })).toBeVisible();

  await signInAsContributor(colleague);
  await colleague.goto(address);
  const theirs = indexTable(colleague);
  await expect(theirs.getByRole("row", { name: /Macunaíma/ })).toBeVisible();

  // Removing two rows takes them out of the document for both people.
  await selectRows(page, ["Macunaíma", "The Hour of the Star"]);
  await page.getByRole("button", { name: "Remove 2" }).click();

  await expect(mine.getByRole("row", { name: /Macunaíma/ })).toHaveCount(0);
  await expect(
    mine.getByRole("row", { name: /The Hour of the Star/ }),
  ).toHaveCount(0);
  await expect(theirs.getByRole("row", { name: /Macunaíma/ })).toHaveCount(0);
  await expect(
    theirs.getByRole("row", { name: /The Hour of the Star/ }),
  ).toHaveCount(0);
  await expect(theirs.getByRole("row", { name: /Backlands/ })).toBeVisible();

  // One Undo brings both rows back, for both people.
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(mine.getByRole("row", { name: /Macunaíma/ })).toBeVisible();
  await expect(theirs.getByRole("row", { name: /Macunaíma/ })).toBeVisible();
  await expect(
    theirs.getByRole("row", { name: /The Hour of the Star/ }),
  ).toBeVisible();

  // Removing them again leaves two rows, which are the ones imported.
  await selectRows(page, ["Macunaíma", "The Hour of the Star"]);
  await page.getByRole("button", { name: "Remove 2" }).click();
  await expect(theirs.getByRole("row", { name: /Macunaíma/ })).toHaveCount(0);

  await submitWorkspace(page, 2);

  await page.goto("/");
  await expectPublicationCount(page, 2);
  await expect(
    indexTable(page).getByRole("link", { name: "Macunaíma" }),
  ).toHaveCount(0);
  await expect(
    indexTable(page).getByRole("link", {
      name: "The Devil to Pay in the Backlands",
    }),
  ).toBeVisible();
});
