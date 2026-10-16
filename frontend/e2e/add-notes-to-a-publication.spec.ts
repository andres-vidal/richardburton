import { test, expect } from "./fixtures";
import {
  csv,
  indexTable,
  notifications,
  openDocument,
  openPublicationModal,
  quoted,
  seedCorpus,
  signInAsAdmin,
  signOut,
  submitWorkspace,
  uploadCsv,
} from "./helpers";

test("an admin writes formatted notes that every reader sees, and a later save of the sources keeps them", async ({
  page,
}) => {
  await seedCorpus(page);
  await page.goto("/");

  const dialog = await openPublicationModal(page, "Barren Lives");
  const address = new URL(page.url()).pathname;
  await dialog.getByRole("button", { name: "Edit" }).click();

  // A paragraph with a bold word, set with the toolbar.
  const notes = dialog.getByRole("textbox", { name: "Notes" });
  const tool = (name: string) =>
    dialog
      .getByRole("toolbar", { name: "Formatting" })
      .getByRole("button", { name });

  await notes.click();
  await page.keyboard.type("A classic of ");
  await tool("Bold").click();
  await expect(tool("Bold")).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.type("regionalist");
  await tool("Bold").click();
  await page.keyboard.type(" fiction.");

  // A bulleted list of two items, left with Enter on an empty item.
  await page.keyboard.press("Enter");
  await tool("Bulleted list").click();
  await page.keyboard.type("First published in 1938");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Translated in 1965");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await expect(tool("Bulleted list")).toHaveAttribute("aria-pressed", "false");

  // A link added through the link dialog, which takes a bare address. Escape
  // in it closes the link dialog and leaves the publication open.
  await page.keyboard.type("Read more at ");
  await tool("Link").click();
  const link = page.getByRole("dialog", { name: "Link" });
  await expect(
    link.getByRole("textbox", { name: "Link address" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(link).toHaveCount(0);
  await expect(dialog).toBeVisible();

  await tool("Link").click();
  await link
    .getByRole("textbox", { name: "Link address" })
    .fill("archive.org/details/barrenlives");
  await link
    .getByRole("textbox", { name: "Link text" })
    .fill("the Internet Archive");
  await link.getByRole("button", { name: "Apply" }).click();
  await expect(link).toHaveCount(0);
  await page.keyboard.type(".");

  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(notifications(page)).toContainText(/Publication updated/);
  await expect(
    dialog.getByRole("heading", { name: "Edit publication" }),
  ).toHaveCount(0);

  // The record shows the notes as they were formatted.
  const shown = dialog.getByRole("region", { name: "Notes" });
  await expect(shown.locator("strong")).toHaveText("regionalist");
  await expect(shown.getByRole("listitem")).toHaveText([
    "First published in 1938",
    "Translated in 1965",
  ]);
  const archive = shown.getByRole("link", { name: "the Internet Archive" });
  await expect(archive).toHaveAttribute(
    "href",
    "https://archive.org/details/barrenlives",
  );
  await expect(archive).toHaveAttribute("target", "_blank");
  await expect(archive).toHaveAttribute("rel", "noopener noreferrer");

  // The history records the change, with the notes rendered.
  await dialog.getByText("History", { exact: true }).click();
  const update = dialog.locator('li[data-action="updated"]');
  await expect(update).toContainText("Notes:");
  await expect(update.locator("ins strong")).toHaveText("regionalist");
  await expect(update.locator("del")).toHaveText("(none)");

  // Notes are not searchable: a word only they hold finds nothing.
  await page.keyboard.press("Escape");
  await page
    .getByRole("textbox", { name: "Search publications" })
    .fill("regionalist");
  await expect(
    page.getByText("No results found, try another query.").first(),
  ).toBeVisible();

  // The sources backfill saves the record it read from the index, which leaves
  // notes out. Adding a source keeps the notes.
  await page.goto("/admin/publications/sources");
  await page
    .getByRole("listbox", { name: "Publications missing sources" })
    .getByRole("option", { name: "Barren Lives" })
    .click();
  await page.getByRole("button", { name: "Add source" }).click();
  await page
    .getByRole("textbox", { name: "Source 1" })
    .fill("Dimmick, Ralph. Translator's note, 1965.");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("option", { name: /Barren Lives.*sourced/ }),
  ).toBeVisible();

  // A reader who is signed out sees the notes on the publication's page.
  await signOut(page);
  await page.goto(address);
  const region = page.getByRole("region", { name: "Notes" });
  await expect(region.locator("strong")).toHaveText("regionalist");
  await expect(
    region.getByRole("link", { name: "the Internet Archive" }),
  ).toHaveAttribute("href", "https://archive.org/details/barrenlives");
  await expect(
    page.getByText("Dimmick, Ralph. Translator's note, 1965."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit" })).toHaveCount(0);
});

// The notes of two rows of the imported CSV. A CSV holds notes as plain text:
// a blank line starts a new paragraph, and a single newline breaks the line.
// Nothing in the text is formatting, so the asterisks and dashes below are
// text.
const IRACEMA_NOTES =
  "Translated in 1886.\nSee the scan at https://archive.org/details/iracema.\n\nReprinted in 1922.";
const BARREN_LIVES_NOTES = "Two editions:\n- *1965*, cloth\n- 1971, paper";

// The notes typed into Dom Casmurro's row below, as the export writes them:
// the blocks in order with a blank line between paragraphs, the list items on
// lines of their own, marks dropped, and each link as its text and its address,
// or its text alone when that is the address.
const DOM_CASMURRO_EXPORT = [
  "Caldwell's own copy, with notes.",
  "",
  "1. Noonday Press, 1953",
  "  - signed by the translator",
  "2. Reprinted in 1997",
  "",
  "See the scan (https://archive.org/details/domcasmurro), or ask curator@example.org for it.",
].join("\n");

test("notes come in with a CSV as plain text, are formatted in the import document, and go out with the export as plain text", async ({
  page,
}) => {
  await signInAsAdmin(page);
  await openDocument(page);

  await uploadCsv(
    page,
    csv(
      [
        `Iracema,1886,GB,Bickers & Son,Isabel Burton,Iracema,José de Alencar,,${quoted(IRACEMA_NOTES)}`,
        `Dom Casmurro,1953,US,Noonday Press,Helen Caldwell,Dom Casmurro,Machado de Assis,,`,
        `Barren Lives,1965,US,University of Texas Press,Ralph Dimmick,Vidas Secas,Graciliano Ramos,,${quoted(BARREN_LIVES_NOTES)}`,
      ],
      { notes: true },
    ),
  );

  const table = indexTable(page);
  const row = (title: string) =>
    table.getByRole("row", { name: new RegExp(`^${title}`) });

  // Each row's notes read as one line of text in its notes cell.
  await expect(
    row("Iracema").getByRole("button", {
      name: "Edit notes: Translated in 1886. See the scan at https://archive.org/details/iracema. Reprinted in 1922.",
    }),
  ).toBeVisible();
  await expect(
    row("Barren Lives").getByRole("button", {
      name: "Edit notes: Two editions: - *1965*, cloth - 1971, paper",
    }),
  ).toBeVisible();

  // The editor opens on the imported notes as two paragraphs of plain text.
  await row("Iracema")
    .getByRole("button", { name: /^Edit notes/ })
    .click();
  let editor = page.getByRole("dialog", { name: "Edit notes" });
  const imported = editor.getByRole("textbox", { name: "Notes" }).locator("p");
  await expect(imported).toHaveText([
    "Translated in 1886. See the scan at https://archive.org/details/iracema.",
    "Reprinted in 1922.",
  ]);
  await expect(editor.locator("[data-bold=true], [data-list]")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(editor).toHaveCount(0);

  // A row without notes gets them in its own editor: a bold phrase set with
  // the keyboard, a numbered list with a bulleted item nested in its first
  // item, a link added through the link dialog, and an email address that is
  // linked as it is typed.
  await row("Dom Casmurro").getByRole("button", { name: "Add notes" }).click();
  editor = page.getByRole("dialog", { name: "Edit notes" });
  const tool = (name: string) =>
    editor
      .getByRole("toolbar", { name: "Formatting" })
      .getByRole("button", { name });

  await editor.getByRole("textbox", { name: "Notes" }).click();
  await page.keyboard.press("ControlOrMeta+b");
  await page.keyboard.type("Caldwell's own copy");
  await page.keyboard.press("ControlOrMeta+b");
  await page.keyboard.type(", with notes.");

  await page.keyboard.press("Enter");
  await tool("Numbered list").click();
  await expect(tool("Numbered list")).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.type("Noonday Press, 1953");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await tool("Bulleted list").click();
  await expect(tool("Bulleted list")).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.type("signed by the translator");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Shift+Tab");
  await tool("Numbered list").click();
  await expect(tool("Numbered list")).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.type("Reprinted in 1997");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await expect(tool("Numbered list")).toHaveAttribute("aria-pressed", "false");

  await page.keyboard.type("See ");
  await page.keyboard.press("ControlOrMeta+k");
  const link = page.getByRole("dialog", { name: "Link" });
  await link
    .getByRole("textbox", { name: "Link address" })
    .fill("archive.org/details/domcasmurro");
  await link.getByRole("textbox", { name: "Link text" }).fill("the scan");
  await link.getByRole("button", { name: "Apply" }).click();
  await expect(link).toHaveCount(0);
  await page.keyboard.type(", or ask curator@example.org for it.");
  await expect(
    editor.getByRole("link", { name: "curator@example.org" }),
  ).toHaveAttribute("href", "mailto:curator@example.org");

  await page.keyboard.press("Escape");
  await expect(
    row("Dom Casmurro").getByRole("button", {
      name: "Edit notes: Caldwell's own copy, with notes. Noonday Press, 1953 signed by the translator Reprinted in 1997 See the scan, or ask curator@example.org for it.",
    }),
  ).toBeVisible();

  await submitWorkspace(page, 3);

  // The inserted publications show their notes. Imported notes keep their
  // paragraphs and line breaks, their bare address is a link, and what looks
  // like formatting in them is text.
  await page.goto("/");
  let publication = await openPublicationModal(page, "Iracema");
  let notes = publication.getByRole("region", { name: "Notes" });
  await expect(notes.locator("p")).toHaveCount(2);
  await expect(notes.locator("p").first().locator("br")).toHaveCount(1);
  await expect(
    notes.getByRole("link", { name: "https://archive.org/details/iracema" }),
  ).toHaveAttribute("href", "https://archive.org/details/iracema");
  await page.keyboard.press("Escape");

  publication = await openPublicationModal(page, "Barren Lives");
  notes = publication.getByRole("region", { name: "Notes" });
  await expect(notes).toContainText("- *1965*, cloth");
  await expect(notes.locator("li, em, strong")).toHaveCount(0);
  await page.keyboard.press("Escape");

  // The notes formatted in the import document keep their formatting.
  publication = await openPublicationModal(page, "Dom Casmurro");
  notes = publication.getByRole("region", { name: "Notes" });
  await expect(notes.locator("strong")).toHaveText("Caldwell's own copy");
  await expect(notes.locator("ol > li")).toHaveCount(2);
  await expect(notes.locator("ol > li > ul > li")).toHaveText([
    "signed by the translator",
  ]);
  await expect(notes.getByRole("link", { name: "the scan" })).toHaveAttribute(
    "href",
    "https://archive.org/details/domcasmurro",
  );
  await expect(
    notes.getByRole("link", { name: "curator@example.org" }),
  ).toHaveAttribute("href", "mailto:curator@example.org");
  await page.keyboard.press("Escape");

  // The export carries every publication's notes as plain text. Imported
  // notes go out as they came in.
  const [response] = await Promise.all([
    page.waitForResponse(
      (r) =>
        r.url().includes("files/publications") &&
        r.request().method() === "GET",
    ),
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Download .csv" }).click(),
  ]);
  const exported = await response.text();

  expect(exported.split("\n")[0]).toMatch(/,notes$/);
  expect(exported).toContain(quoted(IRACEMA_NOTES));
  expect(exported).toContain(quoted(BARREN_LIVES_NOTES));
  expect(exported).toContain(quoted(DOM_CASMURRO_EXPORT));
});
