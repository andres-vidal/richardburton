import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Sign in via the dev-only credentials provider (no Google), a role that may edit
 * publications. The provider mints a subject per role, so signing in as
 * one does not demote the other.
 */
async function signInAs(page: Page, role: "Administrator" | "Contributor") {
  await page.goto("/auth/sign-in");
  await page.getByRole("button", { name: role, exact: true }).click();
  // The route handler redirects to "/"; the footer then shows authed controls.
  // Generous timeout: this is the suite's longest cross-stack chain (two server
  // hops + a full SSR reload), and the busiest tail-latency spot on CI.
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible({
    timeout: 30_000,
  });
}

export const signInAsAdmin = (page: Page) => signInAs(page, "Administrator");

/**
 * Everything an admin can do with the database, and nothing to do with who
 * else may.
 */
export const signInAsContributor = (page: Page) =>
  signInAs(page, "Contributor");

export type PublicationInput = {
  title: string;
  originalTitle: string;
  year: string;
  authors: string;
  originalAuthors: string;
  country: string;
  publisher: string;
};

/** Commit free text into a multiselect. Comma (not Enter) makes it a pill:
 * comma always commits the raw typed text, while Enter prefers the highlighted
 * autocomplete option — whose debounced fetch can race the keystrokes and
 * commit a stale suggestion from a previous fill. */
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
 * Pick an option from an enum multiselect (e.g. Countries). Enum fields have no
 * raw-text commit — the stored value is the option object — so let the async
 * autocomplete settle (it highlights the match) before Enter commits it.
 */
export async function selectEnumOption(
  scope: Locator,
  placeholder: string,
  name: string,
) {
  const input = scope.getByPlaceholder(placeholder, { exact: true });
  await input.click();
  await input.pressSequentially(name);
  await scope.page().waitForTimeout(500);
  await input.press("Enter");
}

/** The workspace's draft row — the one carrying the "Add publication" button.
 * Committed rows keep their inputs (and placeholders), so filling must scope
 * here to stay unambiguous once the grid holds several rows. CSS-based (not
 * getByRole) on purpose: it keeps resolving mid-fill no matter what an open
 * popup's focus manager does to the a11y tree. */
export function draftRow(page: Page) {
  return page
    .locator('[role="row"]')
    .filter({ has: page.locator('button[aria-label="Add publication"]') });
}

/**
 * Fill the workspace draft row (fields are keyed by placeholder — the grid has no
 * <label>s) and materialize it into the working set. Assumes a workspace document
 * is already open.
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

  // Materialize the draft into the working set (async server validation runs).
  await row.getByRole("button", { name: "Add publication" }).click();
}

/** Submit the working set and wait for the success toast. Timeouts are generous
 * so large batches (validation + one bulk insert) fit even on slow CI runners. */
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
 * Attach sources to a committed workspace row through its "Sources" cell:
 * open the row's sources modal, add each source, close, and check the count
 * the button reports.
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

  // The cell button now reports the count — the edits ride the bulk insert.
  await expect(
    row.getByRole("button", { name: `Edit sources (${sources.length})` }),
  ).toBeVisible();
}

/** Sign out from the footer; the signed-out controls return. */
export async function signOut(page: Page) {
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(
    page.getByRole("button", { name: "Sign in with Google" }),
  ).toBeVisible();
}

/** The index footer's running total — the UI's source of truth for "how many". */
export async function expectPublicationCount(page: Page, n: number) {
  await expect(
    page.getByText(new RegExp(`^${n} publications registered so far$`)),
  ).toBeVisible();
}

/** What the same line says once a search has narrowed the database. */
export async function expectMatchCount(page: Page, n: number) {
  const said = n === 0 ? "No publications found" : `${n} publications found`;

  await expect(page.getByText(new RegExp(`^${said}$`))).toBeVisible();
}

/** The desktop index table (scope every index assertion here — a mobile copy of
 * every row also lives in the DOM). */
export function indexTable(page: Page) {
  return page.getByRole("table", { name: "Publications" });
}

/**
 * Assert a publication's full content rendered in the index: every field of its
 * row, not just its presence. Exact matches so sibling fields can't stand in
 * for each other (e.g. a title matching for its own original title). The
 * country holds the display label (that's what the enum stores by
 * construction), which is also what the index renders.
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

/** Open a publication's detail modal by clicking its row in the index. */
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

/** Distinct publications for workspace journeys. Country values must match an
 * option label (the enum field has no raw-text commit); "Brazil" throughout,
 * since the country isn't what these tests exercise. */
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

// A realistic corpus seeded in one shot via CSV bulk-import (8 columns in codec
// A header names the columns, so their order is the file's own; a cell holding
// a comma is quoted. Three works share an author (Machado de Assis) so search
// narrows to several rows, and three rows carry a source while four do not, so
// the backfill wizard sees a real queue.
const CORPUS_ROWS = [
  `Dom Casmurro,1953,US,Noonday Press,Helen Caldwell,Dom Casmurro,Machado de Assis,`,
  `Epitaph of a Small Winner,1952,US,Noonday Press,William Grossman,Memórias Póstumas,Machado de Assis,`,
  `Philosopher or Dog?,1954,US,Noonday Press,Clotilde Wilson,Quincas Borba,Machado de Assis,"Caldwell, Helen. Machado de Assis."`,
  `Iraçéma the Honey-Lips,1886,GB,Bickers & Son,Isabel Burton,Iracema,José de Alencar,"Burton, Isabel. Preface, 1886."`,
  `"Gabriela, Clove and Cinnamon",1962,US,Knopf,James Taylor,"Gabriela, Cravo e Canela",Jorge Amado,`,
  `The Hour of the Star,1986,GB,Carcanet,Giovanni Pontiero,A Hora da Estrela,Clarice Lispector,"Pontiero, Giovanni. Afterword."`,
  `Barren Lives,1965,US,University of Texas Press,Ralph Dimmick,Vidas Secas,Graciliano Ramos,`,
];

/** The header every fixture in this suite writes. */
export const CSV_HEADER =
  "title,year,countries,publishers,authors,original_title,original_authors,sources";

export const CORPUS_CSV = [CSV_HEADER, ...CORPUS_ROWS].join("\n") + "\n";
export const CORPUS_SIZE = CORPUS_ROWS.length; // 7
export const CORPUS_UNSOURCED = 4; // rows with an empty sources column

/** A page holds 20 under `:e2e` (see config/e2e.exs), so this is two of them
 * and a bit: enough to have a first page, a last one, and a boundary between. */
export const PAGED_SIZE = 25;

/** A corpus that outgrows a page. Each row is its own work, so no two collide
 * on the composite key, and the titles sort predictably for the assertions. */
export const PAGED_CSV =
  [
    CSV_HEADER,
    ...Array.from(
      { length: PAGED_SIZE },
      (_, i) =>
        `Paged Work ${String(i).padStart(2, "0")},19${10 + i},US,Paged Press,Paged Translator ${i},Original ${String(i).padStart(2, "0")},Paged Author ${i},`,
    ),
  ].join("\n") + "\n";

/**
 * Start an import document and open it.
 *
 * Rows are prepared in a document, so a journey that enters rows needs one
 * first. The name only has to tell it from another in the shared list.
 */
export async function openDocument(page: Page, name = "E2E batch") {
  await page.goto("/admin/publications/documents");
  await page.getByLabel("Name").fill(name);
  await page.getByRole("button", { name: "Start a document" }).click();
  await expect(page).toHaveURL(/\/admin\/publications\/documents\/\d+$/);
}

/** Seed the corpus by bulk-importing it through the admin CSV upload + submit. */
export async function seedCorpus(page: Page) {
  await signInAsAdmin(page);
  await openDocument(page, "Corpus");

  await page.locator("#upload-csv").setInputFiles({
    name: "corpus.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(CORPUS_CSV),
  });

  await submitWorkspace(page, CORPUS_SIZE);
}
