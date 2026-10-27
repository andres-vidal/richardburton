import { readFile } from "node:fs/promises";
import type { Locator, Page } from "@playwright/test";

import { test, expect } from "./fixtures";
import {
  csv,
  downloadCsv,
  historyEntries,
  indexTable,
  notifications,
  openDocument,
  openPublicationModal,
  quoted,
  seedCorpus,
  signInAsAdmin,
  submitWorkspace,
  uploadCsv,
} from "./helpers";

// The fixtures give every page a fake of the browser's Translator API, which
// translates a text by prefixing it with the target language in brackets:
// "Um clássico." in English is "[en] Um clássico." A journey that corrects a
// draft types over that prefix, as a curator corrects a machine translation.

/** Returns the address of the page at `pathname`, in Portuguese. */
const inPortuguese = (pathname: string) =>
  pathname.replace(/^\/(en\/)?/, "/pt/");

/** Returns the tab of `language` in the tab list named `list` in `scope`. */
const tab = (scope: Locator, list: string, language: string) =>
  scope.getByRole("tablist", { name: list }).getByRole("tab", {
    name: language,
  });

/** The sources a reader is shown, in order, each with its `lang`. */
const shownSources = (scope: Page | Locator) => scope.locator("li[lang]");

/** Opens the edit form of the publication shown in `dialog`. */
async function edit(dialog: Locator) {
  await dialog.getByRole("button", { name: "Edit" }).click();
  await expect(
    dialog.getByRole("heading", { name: "Edit publication" }),
  ).toBeVisible();
}

/** Saves the edit form in `dialog`, and waits for the read view. */
async function save(page: Page, dialog: Locator) {
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(notifications(page)).toContainText(/Publication updated/);
  await expect(
    dialog.getByRole("heading", { name: "Edit publication" }),
  ).toHaveCount(0);
}

test("an admin writes notes in Portuguese, drafts them in English, and each reader is shown the notes in their own language", async ({
  page,
}) => {
  await seedCorpus(page);
  await page.goto("/");

  const dialog = await openPublicationModal(page, "Barren Lives");
  const address = new URL(page.url()).pathname;

  // The notes open on the English tab, for a reader of English. The curator
  // writes them in Portuguese first, in the Portuguese tab.
  await edit(dialog);
  await expect(tab(dialog, "Language of the notes", "English")).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await tab(dialog, "Language of the notes", "Português").click();
  await dialog.getByRole("textbox", { name: "Notes in Portuguese" }).click();
  await page.keyboard.type("Um clássico da ficção regionalista.");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Traduzido em 1965 por Ralph Dimmick.");
  await save(page, dialog);

  // A reader of English is shown the Portuguese notes, since there are none
  // in English, with a line that says so.
  let shown = dialog.getByRole("region", { name: "Notes" });
  await expect(shown).toContainText("Written in Portuguese");
  await expect(shown.locator("div[lang] p")).toHaveText([
    "Um clássico da ficção regionalista.",
    "Traduzido em 1965 por Ralph Dimmick.",
  ]);
  await expect(shown.locator("div[lang]")).toHaveAttribute("lang", "pt");

  // The English notes are drafted from the Portuguese ones, in this browser,
  // and the curator corrects the draft before saving it.
  await edit(dialog);
  const draft = dialog.getByRole("button", {
    name: "Draft the notes from Portuguese",
  });
  await expect(draft).toBeEnabled();
  await draft.click();
  const english = dialog.getByRole("textbox", { name: "Notes in English" });
  await expect(english.locator("p")).toHaveText([
    "[en] Um clássico da ficção regionalista.",
    "[en] Traduzido em 1965 por Ralph Dimmick.",
  ]);
  await english.locator("p").first().click({ clickCount: 3 });
  await page.keyboard.type("A classic of regionalist fiction.");
  await english.locator("p").nth(1).click({ clickCount: 3 });
  await page.keyboard.type("Translated in 1965 by Ralph Dimmick.");
  await expect(english.locator("p")).toHaveText([
    "A classic of regionalist fiction.",
    "Translated in 1965 by Ralph Dimmick.",
  ]);
  await save(page, dialog);

  // A reader of English is now shown the English notes, with no line about
  // their language.
  shown = dialog.getByRole("region", { name: "Notes" });
  await expect(shown.locator("div[lang] p")).toHaveText([
    "A classic of regionalist fiction.",
    "Translated in 1965 by Ralph Dimmick.",
  ]);
  await expect(shown.locator("div[lang]")).toHaveAttribute("lang", "en");
  await expect(shown).not.toContainText("Written in");

  // The history lists the notes of each language as their own change.
  await dialog.getByText("History", { exact: true }).click();
  const updates = historyEntries(dialog, "updated");
  await expect(updates).toHaveCount(2);
  await expect(updates.first()).toContainText("Notes in English:");
  await expect(updates.first()).not.toContainText("Notes in Portuguese:");
  await expect(updates.last()).toContainText("Notes in Portuguese:");
  await page.keyboard.press("Escape");

  // A reader of Portuguese is shown the Portuguese notes.
  await page.goto(inPortuguese(address));
  const notas = page.getByRole("region", { name: "Notas" });
  await expect(notas.locator("div[lang] p")).toHaveText([
    "Um clássico da ficção regionalista.",
    "Traduzido em 1965 por Ralph Dimmick.",
  ]);
  await expect(notas).not.toContainText("Escrito em");

  // Undoing the English notes takes them away and leaves the Portuguese ones,
  // which a reader of English is shown again.
  await page.goto("/en/admin/publications/history");
  await historyEntries(page, "updated")
    .first()
    .getByRole("button", { name: "Undo" })
    .click();
  await expect(page.getByText("Change undone")).toBeVisible();

  await page.goto(address);
  shown = page.getByRole("region", { name: "Notes" });
  await expect(shown).toContainText("Written in Portuguese");
  await expect(shown.locator("div[lang] p")).toHaveText([
    "Um clássico da ficção regionalista.",
    "Traduzido em 1965 por Ralph Dimmick.",
  ]);
});

test("an admin sources a publication in Portuguese, drafts the English texts, and each reader is shown the sources in their own language, in one order", async ({
  page,
}) => {
  await seedCorpus(page);
  await page.goto("/");

  const dialog = await openPublicationModal(
    page,
    "Gabriela, Clove and Cinnamon",
  );
  const address = new URL(page.url()).pathname;
  await edit(dialog);

  // Three sources, written in Portuguese.
  await tab(dialog, "Language of the sources", "Português").click();
  const portuguese = [
    "Amado, Jorge. Gabriela, Cravo e Canela. Martins, 1958.",
    "Taylor, James L. Nota do tradutor, 1962.",
    "Resenha em The New York Times, 1962.",
  ];
  for (const [index, text] of portuguese.entries()) {
    await dialog.getByRole("button", { name: "Add source" }).click();
    await dialog
      .getByRole("textbox", { name: `Source ${index + 1}` })
      .fill(text);
  }

  // The English tab lists the same three, empty, each showing its Portuguese
  // text as the placeholder, and drafts their English texts.
  await tab(dialog, "Language of the sources", "English").click();
  await expect(dialog.getByRole("textbox", { name: "Source 3" })).toHaveValue(
    "",
  );
  await expect(
    dialog.getByRole("textbox", { name: "Source 3" }),
  ).toHaveAttribute("placeholder", "Resenha em The New York Times, 1962.");
  await dialog
    .getByRole("button", { name: "Draft the sources from Portuguese" })
    .click();
  await expect(dialog.getByRole("textbox", { name: "Source 1" })).toHaveValue(
    "[en] Amado, Jorge. Gabriela, Cravo e Canela. Martins, 1958.",
  );
  await expect(
    dialog.getByText(/Check the titles in the drafted sources/),
  ).toBeVisible();

  // The curator corrects the drafts. The cited book keeps its title as
  // written.
  await dialog
    .getByRole("textbox", { name: "Source 1" })
    .fill("Amado, Jorge. Gabriela, Cravo e Canela. Martins, 1958.");
  await dialog
    .getByRole("textbox", { name: "Source 2" })
    .fill("Taylor, James L. Translator's note, 1962.");
  await dialog
    .getByRole("textbox", { name: "Source 3" })
    .fill("Review in The New York Times, 1962.");

  // Removing and moving a source does so in both languages: the translator's
  // note goes, and the review moves first.
  await dialog.getByRole("button", { name: "Remove source 2" }).click();
  await dialog.getByRole("button", { name: "Move source 2 up" }).click();
  await expect(dialog.getByRole("textbox", { name: "Source 1" })).toHaveValue(
    "Review in The New York Times, 1962.",
  );
  await tab(dialog, "Language of the sources", "Português").click();
  await expect(dialog.getByRole("textbox", { name: "Source 1" })).toHaveValue(
    "Resenha em The New York Times, 1962.",
  );
  await expect(dialog.getByRole("textbox", { name: "Source 3" })).toHaveCount(
    0,
  );
  await save(page, dialog);

  // A reader of English is shown the English texts, in the order saved.
  await expect(shownSources(dialog)).toHaveText([
    "Review in The New York Times, 1962.",
    "Amado, Jorge. Gabriela, Cravo e Canela. Martins, 1958.",
  ]);
  await expect(shownSources(dialog).first()).toHaveAttribute("lang", "en");

  // The history lists each source added with its texts in both languages.
  await dialog.getByText("History", { exact: true }).click();
  await expect(historyEntries(dialog, "updated").first()).toContainText(
    "+ Resenha em The New York Times, 1962. / Review in The New York Times, 1962.",
  );
  await page.keyboard.press("Escape");

  // A reader of Portuguese is shown the Portuguese texts, in the same order.
  await page.goto(inPortuguese(address));
  await expect(shownSources(page)).toHaveText([
    "Resenha em The New York Times, 1962.",
    "Amado, Jorge. Gabriela, Cravo e Canela. Martins, 1958.",
  ]);
  await expect(shownSources(page).first()).toHaveAttribute("lang", "pt");

  // A word only the English text holds finds the publication, and the
  // English page marks it in the source it came from.
  await page.goto("/en?search=Review");
  const row = indexTable(page)
    .getByRole("row")
    .filter({ hasText: "Gabriela" })
    .first();
  await expect(row.locator("mark")).toHaveText("Review");
  const found = await openPublicationModal(
    page,
    "Gabriela, Clove and Cinnamon",
  );
  await expect(found.locator('li[lang="en"] mark')).toHaveText("Review");
});

// A file in the current shape: sources and notes in both languages. Line N
// of each sources cell is the same source.
const BILINGUAL_HEADER =
  "title,year,countries,publishers,authors,original_title,original_authors,sources_pt,sources_en,notes_pt,notes_en";
const MACUNAIMA_SOURCES_PT =
  "Andrade, Mário de. Prefácio, 1928.\nProença, M. Cavalcanti. Roteiro de Macunaíma, 1955.";
const MACUNAIMA_SOURCES_EN =
  "Andrade, Mário de. Preface, 1928.\nProença, M. Cavalcanti. A guide to Macunaíma, 1955.";

// A file that cannot pair its sources: the Portuguese cell has a second line
// that the English cell does not reach.
const DEVIL_SOURCES_PT =
  "Rosa, João Guimarães. Entrevista, 1965.\nTaylor, James L. Nota, 1963.";
const DEVIL_SOURCES_EN = "Rosa, João Guimarães. Interview, 1965.";

// A file exported before notes and sources had two languages, whose `sources`
// and `notes` columns are read as Portuguese.
const LEGACY_HEADER =
  "title,year,countries,publishers,authors,original_title,original_authors,sources,notes";

test("notes and sources come in with a CSV in both languages, an older file's are read as Portuguese, sources that cannot be paired are reported, and the export writes both languages", async ({
  page,
}) => {
  await signInAsAdmin(page);
  await openDocument(page, "Two languages");
  const table = indexTable(page);

  await uploadCsv(
    page,
    csv(
      [
        `Macunaíma,1984,US,Random House,E. A. Goodland,Macunaíma,Mário de Andrade,${quoted(MACUNAIMA_SOURCES_PT)},${quoted(MACUNAIMA_SOURCES_EN)},A rapsódia modernista.,The modernist rhapsody.`,
      ],
      { header: BILINGUAL_HEADER },
    ),
    "bilingual.csv",
  );
  await expect(table.getByRole("row", { name: /Macunaíma/ })).toBeVisible();

  await uploadCsv(
    page,
    csv(
      [
        `The Passion According to G.H.,1988,US,University of Minnesota Press,Ronald W. Sousa,A Paixão Segundo G.H.,Clarice Lispector,"Sousa, Ronald W. Introdução, 1988.",Primeira tradução inglesa.`,
      ],
      { header: LEGACY_HEADER },
    ),
    "legacy.csv",
  );
  await expect(
    table.getByRole("row", { name: /The Passion According/ }),
  ).toBeVisible();

  await uploadCsv(
    page,
    csv(
      [
        `The Devil to Pay in the Backlands,1963,US,Knopf,James L. Taylor;Harriet de Onís,Grande Sertão: Veredas,João Guimarães Rosa,${quoted(DEVIL_SOURCES_PT)},${quoted(DEVIL_SOURCES_EN)},,`,
      ],
      { header: BILINGUAL_HEADER },
    ),
    "unpaired.csv",
  );

  // The rows of the older file are in Portuguese: the notes cell shows the
  // Portuguese notes to a reader of English, who has none in English.
  await expect(
    table
      .getByRole("row", { name: /The Passion According/ })
      .getByRole("button", { name: "Edit notes: Primeira tradução inglesa." }),
  ).toBeVisible();

  // The file that cannot pair its sources is reported, and holds the row
  // back.
  const counter = page.getByLabel("1 invalid publication");
  await expect(counter).toBeVisible({ timeout: 30_000 });
  await counter.click();
  const errors = page.getByRole("dialog", {
    name: "What is wrong with these rows",
  });
  await expect(errors.getByRole("listitem")).toHaveCount(1);
  await expect(errors).toContainText("The Devil to Pay in the Backlands");
  await expect(errors).toContainText("Sources");
  await expect(errors).toContainText("different numbers of lines");
  await page.keyboard.press("Escape");

  // The row came in with its sources paired as far as the lines go. Giving
  // the second source its English text pairs them, and the row is valid.
  const devil = table.getByRole("row", { name: /The Devil to Pay/ });
  await devil.getByRole("button", { name: "Edit sources (2)" }).click();
  const sources = page.getByRole("dialog", { name: "Edit sources" });
  await expect(sources).toContainText("different numbers of lines");
  await expect(sources.getByRole("textbox", { name: "Source 1" })).toHaveValue(
    DEVIL_SOURCES_EN,
  );
  await expect(
    sources.getByRole("textbox", { name: "Source 2" }),
  ).toHaveAttribute("placeholder", "Taylor, James L. Nota, 1963.");
  await sources
    .getByRole("textbox", { name: "Source 2" })
    .fill("Taylor, James L. A note, 1963.");
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("All publications are valid")).toBeVisible({
    timeout: 30_000,
  });

  await submitWorkspace(page, 3);

  // A reader of English is shown each publication's English notes and
  // sources, and the Portuguese ones where there are no English ones.
  await page.goto("/");
  let dialog = await openPublicationModal(page, "Macunaíma");
  const macunaima = new URL(page.url()).pathname;
  await expect(
    dialog.getByRole("region", { name: "Notes" }).locator("div[lang] p"),
  ).toHaveText(["The modernist rhapsody."]);
  await expect(shownSources(dialog)).toHaveText(
    MACUNAIMA_SOURCES_EN.split("\n"),
  );
  await page.keyboard.press("Escape");

  dialog = await openPublicationModal(page, "The Passion According to G.H.");
  const passion = dialog.getByRole("region", { name: "Notes" });
  await expect(passion).toContainText("Written in Portuguese");
  await expect(passion.locator("div[lang] p")).toHaveText([
    "Primeira tradução inglesa.",
  ]);
  await expect(shownSources(dialog)).toHaveText([
    "Sousa, Ronald W. Introdução, 1988.",
  ]);
  await expect(shownSources(dialog)).toHaveAttribute("lang", "pt");
  await page.keyboard.press("Escape");

  // A reader of Portuguese is shown the Portuguese ones.
  await page.goto(inPortuguese(macunaima));
  await expect(
    page.getByRole("region", { name: "Notas" }).locator("div[lang] p"),
  ).toHaveText(["A rapsódia modernista."]);
  await expect(shownSources(page)).toHaveText(MACUNAIMA_SOURCES_PT.split("\n"));

  // The export writes the sources and the notes of each language in columns
  // of their own, the sources one per line. The saved file is read as UTF-8,
  // because its response names no charset and the browser reports the
  // response's text as Latin-1.
  await page.goto("/en");
  const { download } = await downloadCsv(page);
  const exported = await readFile(await download.path(), "utf-8");

  expect(exported.split("\n")[0]).toMatch(
    /,sources_pt,sources_en,notes_pt,notes_en$/,
  );
  expect(exported).toContain(quoted(MACUNAIMA_SOURCES_PT));
  expect(exported).toContain(quoted(MACUNAIMA_SOURCES_EN));
  expect(exported).toContain("A rapsódia modernista.,The modernist rhapsody.");
  expect(exported).toContain(quoted(DEVIL_SOURCES_PT));
  expect(exported).toContain(
    quoted(`${DEVIL_SOURCES_EN}\nTaylor, James L. A note, 1963.`),
  );
  expect(exported).toContain("Primeira tradução inglesa.");
});

test("merging records whose notes and sources are in different languages joins each language on its own, and the reviewer drafts the missing notes", async ({
  page,
}) => {
  await seedCorpus(page);

  // Two more records of the corpus's Dom Casmurro, each with notes in
  // Portuguese only. Both cite Caldwell's introduction, one in Portuguese
  // only, the other in both languages.
  await openDocument(page, "Duplicates");
  await uploadCsv(
    page,
    csv(
      [
        `Dom Casmurro,1953,GB,W. H. Allen,Helen Caldwell,Dom Casmurro,Machado de Assis,"Caldwell, Helen. Introdução, 1953.",,Exemplar da editora.,`,
        `Dom Casmurro,1953,BR,Livraria Garnier,Helen Caldwell,Dom Casmurro,Machado de Assis,"Caldwell, Helen. Introdução, 1953.","Caldwell, Helen. Introduction, 1953.",Carimbado pelo livreiro.,`,
      ],
      { header: BILINGUAL_HEADER },
    ),
    "duplicates.csv",
  );
  await submitWorkspace(page, 2);

  // The merge is asked from the corpus's record, which Noonday Press
  // published, and takes in the two.
  await page.goto("/");
  await indexTable(page)
    .getByRole("row")
    .filter({ hasText: "Dom Casmurro" })
    .filter({ hasText: "Noonday Press" })
    .click();
  const details = page.getByRole("dialog", { name: "Publication details" });
  await expect(details).toBeVisible();
  const address = new URL(page.url()).pathname;
  await details.getByRole("button", { name: "Merge" }).click();

  const merge = page.getByRole("dialog", { name: "Merge publications" });
  await merge
    .getByRole("textbox", { name: "Search for publications to merge" })
    .fill("Dom Casmurro");
  for (const publisher of ["W. H. Allen", "Livraria Garnier"]) {
    await merge
      .getByRole("listitem")
      .filter({ hasText: publisher })
      .getByRole("button", { name: "Add" })
      .click();
  }

  // The two records cite the same introduction, so the result gains it once,
  // with its text in both languages.
  const result = merge.getByRole("region", { name: "Result" });
  await expect(
    result.getByText(
      "Caldwell, Helen. Introdução, 1953. / Caldwell, Helen. Introduction, 1953.",
      { exact: true },
    ),
  ).toBeVisible();

  // The Portuguese notes of the two are joined, and there are none in
  // English, so the reviewer drafts them.
  await tab(merge, "Language of the notes", "Português").click();
  await expect(
    merge.getByRole("textbox", { name: "Notes in Portuguese" }).locator("p"),
  ).toHaveText(["Exemplar da editora.", "Carimbado pelo livreiro."]);
  await tab(merge, "Language of the notes", "English").click();
  await merge
    .getByRole("button", { name: "Draft the notes from Portuguese" })
    .click();
  await expect(
    merge.getByRole("textbox", { name: "Notes in English" }).locator("p"),
  ).toHaveText(["[en] Exemplar da editora.", "[en] Carimbado pelo livreiro."]);

  await merge.getByRole("button", { name: "Merge 2 publications" }).click();
  await expect(notifications(page)).toContainText(/Merged 2 publications/);

  // The merged record has the notes in both languages, and the one source.
  await page.goto(address);
  await expect(
    page.getByRole("region", { name: "Notes" }).locator("div[lang] p"),
  ).toHaveText(["[en] Exemplar da editora.", "[en] Carimbado pelo livreiro."]);
  await expect(shownSources(page)).toHaveText([
    "Caldwell, Helen. Introduction, 1953.",
  ]);

  await page.goto(inPortuguese(address));
  await expect(
    page.getByRole("region", { name: "Notas" }).locator("div[lang] p"),
  ).toHaveText(["Exemplar da editora.", "Carimbado pelo livreiro."]);
  await expect(shownSources(page)).toHaveText([
    "Caldwell, Helen. Introdução, 1953.",
  ]);
});

test("drafting over notes that a tab already holds asks first, and cancelling keeps them", async ({
  page,
}) => {
  await seedCorpus(page);
  await page.goto("/");

  const dialog = await openPublicationModal(page, "Iraçéma the Honey-Lips");
  await edit(dialog);

  // Notes in both languages, the English first.
  const english = dialog.getByRole("textbox", { name: "Notes in English" });
  await english.click();
  await page.keyboard.type("Isabel Burton's own translation.");
  await tab(dialog, "Language of the notes", "Português").click();
  await dialog.getByRole("textbox", { name: "Notes in Portuguese" }).click();
  await page.keyboard.type("A tradução de Isabel Burton.");
  await tab(dialog, "Language of the notes", "English").click();

  // Drafting would replace the English notes, so it asks. Cancelling keeps
  // them.
  const draft = dialog.getByRole("button", {
    name: "Draft the notes from Portuguese",
  });
  await draft.click();
  const question = page.getByRole("dialog", {
    name: "Replace the notes in English?",
  });
  await question.getByRole("button", { name: "Cancel" }).click();
  await expect(question).toHaveCount(0);
  await expect(english.locator("p")).toHaveText([
    "Isabel Burton's own translation.",
  ]);

  // Confirming replaces them with the draft, which is saved.
  await draft.click();
  await question.getByRole("button", { name: "Replace" }).click();
  await expect(english.locator("p")).toHaveText([
    "[en] A tradução de Isabel Burton.",
  ]);
  await save(page, dialog);

  await expect(
    dialog.getByRole("region", { name: "Notes" }).locator("div[lang] p"),
  ).toHaveText(["[en] A tradução de Isabel Burton."]);
});

test.describe("in a browser without the Translator API", () => {
  test.use({ translator: false });

  test("the editors offer no draft, and notes and sources are still written in both languages", async ({
    page,
  }) => {
    await seedCorpus(page);
    await page.goto("/");

    const dialog = await openPublicationModal(page, "The Hour of the Star");
    const address = new URL(page.url()).pathname;
    await edit(dialog);
    await expect(
      dialog.getByRole("textbox", { name: "Notes in English" }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: /^Draft the/ }),
    ).toHaveCount(0);

    // The corpus's source is in English. Its Portuguese text is typed in the
    // Portuguese tab, where the English text is the placeholder.
    await tab(dialog, "Language of the sources", "Português").click();
    const source = dialog.getByRole("textbox", { name: "Source 1" });
    await expect(source).toHaveAttribute(
      "placeholder",
      "Pontiero, Giovanni. Afterword.",
    );
    await source.fill("Pontiero, Giovanni. Posfácio.");

    // The notes in each language, each in its tab.
    await dialog.getByRole("textbox", { name: "Notes in English" }).click();
    await page.keyboard.type("Translated by Giovanni Pontiero.");
    await tab(dialog, "Language of the notes", "Português").click();
    await dialog.getByRole("textbox", { name: "Notes in Portuguese" }).click();
    await page.keyboard.type("Traduzido por Giovanni Pontiero.");
    await expect(
      dialog.getByRole("button", { name: /^Draft the/ }),
    ).toHaveCount(0);
    await save(page, dialog);

    await expect(
      dialog.getByRole("region", { name: "Notes" }).locator("div[lang] p"),
    ).toHaveText(["Translated by Giovanni Pontiero."]);
    await expect(shownSources(dialog)).toHaveText([
      "Pontiero, Giovanni. Afterword.",
    ]);

    await page.keyboard.press("Escape");
    await page.goto(inPortuguese(address));
    await expect(
      page.getByRole("region", { name: "Notas" }).locator("div[lang] p"),
    ).toHaveText(["Traduzido por Giovanni Pontiero."]);
    await expect(shownSources(page)).toHaveText([
      "Pontiero, Giovanni. Posfácio.",
    ]);
  });
});
