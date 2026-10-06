import { test, expect } from "./fixtures";
import {
  CSV_HEADER,
  expectPublicationCount,
  indexTable,
  openDocument,
  selectRows,
  signInAsAdmin,
  submitWorkspace,
  uploadCsv,
} from "./helpers";

/** A batch of four new publications. */
const BATCH_CSV =
  [
    CSV_HEADER,
    `Captains of the Sands,1988,US,Avon Books,Gregory Rabassa,Capitães da Areia,Jorge Amado,`,
    `The Alienist,2012,US,Melville House,William L. Grossman,O Alienista,Machado de Assis,`,
    `Family Ties,1972,US,University of Texas Press,Giovanni Pontiero,Laços de Família,Clarice Lispector,`,
    `São Bernardo,1975,GB,Peter Owen,R. L. Scott-Buccleuch,São Bernardo,Graciliano Ramos,`,
  ].join("\n") + "\n";

test("Ctrl+Z and Ctrl+Shift+Z undo and redo a removal, and a text field keeps the keys for its own text", async ({
  page,
}) => {
  await signInAsAdmin(page);
  await openDocument(page, "Keyboard");

  await uploadCsv(page, BATCH_CSV, "keyboard.csv");
  const table = indexTable(page);
  const alienist = table.getByRole("row", { name: /The Alienist/ });
  const familyTies = table.getByRole("row", { name: /Family Ties/ });
  const captains = table.getByRole("row", { name: /Captains of the Sands/ });
  await expect(alienist).toBeVisible();

  await selectRows(page, ["The Alienist", "Family Ties"]);
  await page.getByRole("button", { name: "Remove 2" }).click();
  await expect(alienist).toHaveCount(0);
  await expect(familyTies).toHaveCount(0);

  // Ctrl+Z (Cmd+Z on a Mac) brings both rows back, and Ctrl+Shift+Z takes
  // them out again.
  await page.keyboard.press("ControlOrMeta+z");
  await expect(alienist).toBeVisible();
  await expect(familyTies).toBeVisible();

  await page.keyboard.press("ControlOrMeta+Shift+z");
  await expect(alienist).toHaveCount(0);
  await expect(familyTies).toHaveCount(0);

  // Ctrl+Z in a title field is left to the field, so the document does not
  // undo the removal. The next Ctrl+Z, outside the field, does: if the press
  // in the field had undone it, this one would undo the upload instead.
  const title = captains.getByRole("textbox", { name: "Title" });
  await title.click();
  await page.keyboard.press("ControlOrMeta+z");
  await expect(title).toBeFocused();
  await expect(title).toHaveValue("Captains of the Sands");
  await title.blur();

  await page.keyboard.press("ControlOrMeta+z");
  await expect(alienist).toBeVisible();
  await expect(familyTies).toBeVisible();
  await expect(captains).toBeVisible();

  // Ctrl+Y redoes too, which leaves the two rows that are imported.
  await page.keyboard.press("Control+y");
  await expect(alienist).toHaveCount(0);
  await expect(familyTies).toHaveCount(0);

  await submitWorkspace(page, 2);

  await page.goto("/");
  await expectPublicationCount(page, 2);
  await expect(
    indexTable(page).getByRole("link", { name: "The Alienist" }),
  ).toHaveCount(0);
  await expect(
    indexTable(page).getByRole("link", { name: "São Bernardo" }),
  ).toBeVisible();
});
