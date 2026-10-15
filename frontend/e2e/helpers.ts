import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Signs in as `role` with the development sign-in, which needs no Google
 * account, and waits for the index the sign-in lands on. The backend keeps one
 * account per role, so signing in as one role does not change the other's.
 */
async function signInAs(page: Page, role: "Administrator" | "Contributor") {
  await page.goto("/auth/sign-in");
  await page.getByRole("button", { name: role, exact: true }).click();
  // The longest chain in the suite: two server requests and a full page load,
  // and the slowest step on CI.
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible({
    timeout: 30_000,
  });
}

/** Signs in as an admin, who may do everything. */
export const signInAsAdmin = (page: Page) => signInAs(page, "Administrator");

/**
 * Signs in as a contributor, who may do everything an admin does with the
 * database, but may not decide who has access.
 */
export const signInAsContributor = (page: Page) =>
  signInAs(page, "Contributor");

/** Signs out from the banner, and waits for the sign-in button to return. */
export async function signOut(page: Page) {
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(
    page.getByRole("button", { name: "Sign in with Google" }),
  ).toBeVisible();
}

/** A publication as a journey types it, each field as the page shows it. */
export type PublicationInput = {
  title: string;
  originalTitle: string;
  year: string;
  authors: string;
  originalAuthors: string;
  country: string;
  publisher: string;
};

/**
 * Types `value` into the multiselect with `placeholder` in `scope`, and
 * commits it as a pill with a comma. A comma commits the typed text, while
 * Enter commits the highlighted suggestion, which may still be one for an
 * earlier value.
 */
export async function commitMulti(
  scope: Locator,
  placeholder: string,
  value: string,
) {
  const input = scope.getByPlaceholder(placeholder, { exact: true });
  await input.click();
  await input.pressSequentially(value);
  await input.press(",");
}

/**
 * Types `name` into the option field with `placeholder` in `scope`, such as
 * Countries, and picks the first match with Enter once the field's lookup has
 * answered, when `aria-busy` is false again. An option field takes no typed
 * text, only an option.
 */
export async function selectEnumOption(
  scope: Locator,
  placeholder: string,
  name: string,
) {
  const input = scope.getByPlaceholder(placeholder, { exact: true });
  await input.click();
  await input.pressSequentially(name);
  await expect(input).toHaveAttribute("aria-busy", "false");
  await input.press("Enter");
}

/**
 * The open document's row for a new publication, the one with the "Add
 * publication" button. The other rows have the same placeholders, so a
 * journey that types a new publication scopes to this row. It is found by CSS
 * rather than by role, so it is still found while a popup's focus manager
 * hides the rest of the page from the accessibility tree.
 */
export function draftRow(page: Page) {
  return page
    .locator('[role="row"]')
    .filter({ has: page.locator('button[aria-label="Add publication"]') });
}

/**
 * Types `pub` into the open document's row for a new publication, field by
 * field, and adds it to the document. The fields are found by placeholder,
 * since the table has no labels.
 */
export async function addPublicationRow(page: Page, pub: PublicationInput) {
  const row = draftRow(page);

  await row.getByPlaceholder("Title", { exact: true }).fill(pub.title);
  await row
    .getByPlaceholder("Original Title", { exact: true })
    .fill(pub.originalTitle);
  await row.getByPlaceholder("Year", { exact: true }).fill(pub.year);
  await commitMulti(row, "Translators", pub.authors);
  await commitMulti(row, "Original Authors", pub.originalAuthors);
  await selectEnumOption(row, "Countries", pub.country);
  await commitMulti(row, "Publishers", pub.publisher);

  await row.getByRole("button", { name: "Add publication" }).click();
}

/**
 * Submits the open document, and waits until it says `count` publications
 * were inserted. The waits are long enough for a large batch on CI.
 */
export async function submitWorkspace(page: Page, count: number) {
  const submit = page.getByRole("button", { name: "Submit" });
  await expect(submit).toBeEnabled({ timeout: 30_000 });
  await submit.click();
  await expect(
    page.getByText(
      `${count} publication${count === 1 ? "" : "s"} inserted successfully`,
    ),
  ).toBeVisible({ timeout: 30_000 });
}

/**
 * Adds `sources` to the open document's row named `rowName` in its sources
 * dialog, closes the dialog, and checks that the row's button counts them.
 */
export async function addRowSources(
  page: Page,
  rowName: string | RegExp,
  sources: string[],
) {
  const row = indexTable(page).getByRole("row", { name: rowName });
  await row.getByRole("button", { name: "Add sources" }).click();

  const dialog = page.getByRole("dialog", { name: "Edit sources" });
  await expect(dialog).toBeVisible();
  for (const [index, source] of sources.entries()) {
    await dialog.getByRole("button", { name: "Add source" }).click();
    await dialog
      .getByRole("textbox", { name: `Source ${index + 1}` })
      .fill(source);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);

  await expect(
    row.getByRole("button", { name: `Edit sources (${sources.length})` }),
  ).toBeVisible();
}

/** Waits until the index says it holds `n` publications. */
export async function expectPublicationCount(page: Page, n: number) {
  await expect(
    page.getByText(new RegExp(`^${n} publications registered so far$`)),
  ).toBeVisible();
}

/** Waits until the index says a search found `n` publications. */
export async function expectMatchCount(page: Page, n: number) {
  const said = n === 0 ? "No publications found" : `${n} publications found`;

  await expect(page.getByText(new RegExp(`^${said}$`))).toBeVisible();
}

/**
 * The table of the index or of an open document. Assertions on rows scope to
 * it, since the index's list for small screens holds every row too.
 */
export function indexTable(page: Page) {
  return page.getByRole("table", { name: "Publications" });
}

/**
 * Waits until the index shows every field of `pub` in its row. Each field is
 * matched exactly, so a title cannot pass for its original title.
 */
export async function expectPublicationRow(page: Page, pub: PublicationInput) {
  const row = indexTable(page)
    .getByRole("row")
    .filter({ hasText: pub.title })
    .first();
  await row.scrollIntoViewIfNeeded();

  for (const value of [
    pub.title,
    pub.originalTitle,
    pub.authors,
    pub.originalAuthors,
    pub.year,
    pub.country,
    pub.publisher,
  ]) {
    await expect(row.getByText(value, { exact: true })).toBeVisible();
  }
}

/**
 * Opens the publication titled `title` from its row in the index, and returns
 * its dialog once it is visible.
 */
export async function openPublicationModal(page: Page, title: string) {
  await indexTable(page)
    .getByRole("row")
    .filter({ hasText: title })
    .first()
    .click();
  const dialog = page.getByRole("dialog", { name: "Publication details" });
  await expect(dialog).toBeVisible();
  return dialog;
}

/**
 * The stack of notifications. It is found by CSS rather than by role, because
 * an open dialog hides the rest of the page, the stack included, from the
 * accessibility tree.
 */
export function notifications(page: Page) {
  return page.locator("section[aria-label='Notifications']");
}

/**
 * Waits for the notification that a link was copied, and returns the part of
 * the address it names that `address` matches. The test follows the link
 * without reading the clipboard.
 */
export async function copiedLink(page: Page, address: RegExp) {
  await expect(notifications(page)).toContainText(
    new RegExp(`Link copied[\\s\\S]*${address.source}`),
  );

  return (await notifications(page).innerText()).match(address)![0];
}

/** The entries of a history feed in `scope` that record `action`. */
export function historyEntries(scope: Page | Locator, action: string) {
  return scope.locator(`li[data-action="${action}"]`);
}

/**
 * The entries of the list of import documents. The list is found by its name,
 * because the breadcrumb on the same page is a list too.
 */
export function documentEntries(page: Page) {
  return page
    .getByRole("list", { name: "Import documents" })
    .getByRole("listitem");
}

/**
 * Starts an import document called `name` and waits for its page to open.
 *
 * New rows are entered in a document, so a journey that enters rows calls this
 * first. A test that starts several documents, or looks one up in the list,
 * passes a name of its own.
 */
export async function openDocument(page: Page, name = "E2E batch") {
  await page.goto("/admin/publications/documents");
  await page.getByLabel("Name").fill(name);
  await page.getByRole("button", { name: "Start a document" }).click();
  await expect(page).toHaveURL(/\/admin\/publications\/documents\/\d+$/);
}

/** Uploads `csv` through the upload control, as a file called `name`. */
export async function uploadCsv(page: Page, csv: string, name = "import.csv") {
  await page.locator("#upload-csv").setInputFiles({
    name,
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
}

/**
 * Selects the open document's `row` by clicking its leading cell, off its
 * centre, where an error icon would open a tooltip. With `add`, Cmd is held,
 * so the row is added to the rows already selected.
 */
export async function selectRow(row: Locator, { add = false } = {}) {
  await row
    .getByRole("cell")
    .first()
    .click({ position: { x: 4, y: 4 }, modifiers: add ? ["Meta"] : [] });
}

/** Selects the open document's rows whose names match `titles`. */
export async function selectRows(page: Page, titles: string[]) {
  for (const [index, title] of titles.entries()) {
    await selectRow(
      indexTable(page).getByRole("row", { name: new RegExp(title) }),
      { add: index > 0 },
    );
  }
}

/**
 * Moves the rows selected in the open document to another import document: a
 * new one named `to.new`, or the existing one named `to.existing`. Waits for the
 * dialog to say the rows moved, and closes it with **Done**.
 */
export async function moveSelectedRows(
  page: Page,
  count: number,
  to: { new: string } | { existing: string },
) {
  const rows = count === 1 ? "row" : "rows";

  // Exact, because "Remove N" contains "Move N" in any letter case.
  await page
    .getByRole("button", { name: `Move ${count}`, exact: true })
    .click();

  const dialog = page.getByRole("dialog", {
    name: `Move ${count} ${rows} to another document`,
  });

  if ("new" in to) {
    await dialog
      .getByRole("textbox", { name: "Name of the new document" })
      .fill(to.new);
  } else {
    const name = to.existing.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    await dialog.getByRole("radio", { name: new RegExp(`^${name} `) }).check();
  }

  await dialog.getByRole("button", { name: `Move ${count} ${rows}` }).click();

  const moved = page.getByRole("dialog", { name: `Moved ${count} ${rows}` });
  await expect(moved).toBeVisible({ timeout: 30_000 });
  await moved.getByRole("button", { name: "Done" }).click();
  await expect(moved).not.toBeVisible();
}

/** Confirms the fold that a rename in Names asks about. */
export async function agreeToFold(page: Page) {
  const asking = page.getByRole("dialog", { name: "Fold these two together?" });
  await expect(asking).toBeVisible();

  await asking.getByRole("button", { name: "Fold them" }).click();
}

/**
 * Opens the menu labelled `label`, such as a `Select` or a role menu, and
 * picks its option named `option`.
 */
export async function chooseOption(page: Page, label: string, option: string) {
  await page.getByLabel(label, { exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

/** The header of every CSV the suite uploads. */
const CSV_HEADER =
  "title,year,countries,publishers,authors,original_title,original_authors,sources";

/**
 * Returns a CSV of `rows` under the suite's header, one line each. A cell that
 * holds a comma is quoted. With `notes`, the header ends with a
 * `notes` column, which each row fills last.
 */
export function csv(rows: string[], { notes = false } = {}): string {
  const header = notes ? `${CSV_HEADER},notes` : CSV_HEADER;

  return [header, ...rows].join("\n") + "\n";
}

/**
 * Returns `text` as one quoted CSV cell, with each quote in it doubled, so it
 * may hold commas, quotes and line breaks.
 */
export function quoted(text: string): string {
  return `"${text.replaceAll('"', '""')}"`;
}

/**
 * Three publications for the journeys that type rows. A country is typed as
 * the option's label, since the field takes only an option. It is Brazil
 * throughout, since no journey that uses these is about the country.
 */
export const PUBLICATIONS: PublicationInput[] = [
  {
    title: "Iracema (E2E)",
    originalTitle: "Iracema",
    year: "1886",
    authors: "Isabel Burton",
    originalAuthors: "José de Alencar",
    country: "Brazil",
    publisher: "Bickers & Son",
  },
  {
    title: "Dom Casmurro (E2E)",
    originalTitle: "Dom Casmurro",
    year: "1953",
    authors: "Helen Caldwell",
    originalAuthors: "Machado de Assis",
    country: "Brazil",
    publisher: "Noonday Press",
  },
  {
    title: "Barren Lives (E2E)",
    originalTitle: "Vidas Secas",
    year: "1965",
    authors: "Ralph Dimmick",
    originalAuthors: "Graciliano Ramos",
    country: "Brazil",
    publisher: "University of Texas Press",
  },
];

// The corpus: seven publications, imported with one upload. Three works share
// an author, Machado de Assis, so a search for him narrows to several rows.
// Three rows cite a source and four do not, so the sources backfill has a
// queue.
const CORPUS_ROWS = [
  `Dom Casmurro,1953,US,Noonday Press,Helen Caldwell,Dom Casmurro,Machado de Assis,`,
  `Epitaph of a Small Winner,1952,US,Noonday Press,William Grossman,Memórias Póstumas,Machado de Assis,`,
  `Philosopher or Dog?,1954,US,Noonday Press,Clotilde Wilson,Quincas Borba,Machado de Assis,"Caldwell, Helen. Machado de Assis."`,
  `Iraçéma the Honey-Lips,1886,GB,Bickers & Son,Isabel Burton,Iracema,José de Alencar,"Burton, Isabel. Preface, 1886."`,
  `"Gabriela, Clove and Cinnamon",1962,US,Knopf,James Taylor,"Gabriela, Cravo e Canela",Jorge Amado,`,
  `The Hour of the Star,1986,GB,Carcanet,Giovanni Pontiero,A Hora da Estrela,Clarice Lispector,"Pontiero, Giovanni. Afterword."`,
  `Barren Lives,1965,US,University of Texas Press,Ralph Dimmick,Vidas Secas,Graciliano Ramos,`,
];

/** How many publications the corpus holds. */
export const CORPUS_SIZE = CORPUS_ROWS.length;

/** How many of the corpus's publications cite no source. */
export const CORPUS_UNSOURCED = 4;

/** The corpus's Iracema, field by field as the index shows it. */
export const CORPUS_IRACEMA: PublicationInput = {
  title: "Iraçéma the Honey-Lips",
  originalTitle: "Iracema",
  year: "1886",
  authors: "Isabel Burton",
  originalAuthors: "José de Alencar",
  country: "United Kingdom",
  publisher: "Bickers & Son",
};

/** Signs in as an admin and imports the corpus through an import document. */
export async function seedCorpus(page: Page) {
  await signInAsAdmin(page);
  await openDocument(page, "Corpus");

  await uploadCsv(page, csv(CORPUS_ROWS), "corpus.csv");

  await submitWorkspace(page, CORPUS_SIZE);
}

/**
 * How many publications `PAGED_CSV` holds. The index's page holds 20 under
 * `:e2e` (see backend/config/e2e.exs), so this is a first page, a last page,
 * and a boundary between them.
 */
export const PAGED_SIZE = 25;

/**
 * A corpus of `PAGED_SIZE` publications, more than a page. Each is a work of
 * its own, so no two share a composite key, and the titles sort in the order
 * they are numbered.
 */
export const PAGED_CSV = csv(
  Array.from(
    { length: PAGED_SIZE },
    (_, i) =>
      `Paged Work ${String(i).padStart(2, "0")},19${10 + i},US,Paged Press,Paged Translator ${i},Original ${String(i).padStart(2, "0")},Paged Author ${i},`,
  ),
);

/** Two rows, Dom Casmurro and Iracema, that the document journeys upload. */
export const IMPORT_ROWS = [
  `Dom Casmurro,1953,US,Noonday Press,Helen Caldwell,Dom Casmurro,Machado de Assis,`,
  `Iracema,1886,GB,Bickers & Son,Isabel Burton,Iracema,José de Alencar,`,
];

/** `IMPORT_ROWS` as a CSV. */
export const IMPORT_CSV = csv(IMPORT_ROWS);
