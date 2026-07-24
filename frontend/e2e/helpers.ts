import { expect, type Locator, type Page } from "@playwright/test";

/** Sign in as admin via the dev-only credentials provider (no Google). */
export async function signInAsAdmin(page: Page) {
  await page.goto("/auth/sign-in");
  await page.getByRole("button", { name: "Dev admin sign-in" }).click();
  // The route handler redirects to "/"; the footer then shows authed controls.
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
}

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
async function commitMulti(scope: Locator, placeholder: string, value: string) {
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
async function selectEnumOption(
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
function draftRow(page: Page) {
  return page
    .locator('[role="row"]')
    .filter({ has: page.locator('button[aria-label="Add publication"]') });
}

/**
 * Fill the workspace draft row (fields are keyed by placeholder — the grid has no
 * <label>s) and materialize it into the working set. Assumes the page is already
 * on /admin/publications/new.
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
 * Attach references to a committed workspace row through its "Sources" cell:
 * open the row's references modal, add each source, close, and check the count
 * the button reports.
 */
export async function addRowReferences(
  page: Page,
  rowName: string | RegExp,
  references: string[],
) {
  const row = indexTable(page).getByRole("row", { name: rowName });
  await row.getByRole("button", { name: "Add references" }).click();

  const dialog = page.getByRole("dialog", { name: "Edit references" });
  await expect(dialog).toBeVisible();
  for (const [index, reference] of references.entries()) {
    await dialog.getByRole("button", { name: "Add reference" }).click();
    await dialog
      .getByRole("textbox", { name: `Reference ${index + 1}` })
      .fill(reference);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);

  // The cell button now reports the count — the edits ride the bulk insert.
  await expect(
    row.getByRole("button", { name: `Edit references (${references.length})` }),
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
// order: original_authors; year; countries; original_title; title; authors;
// publishers; references). Three works share an author (Machado de Assis) so
// search narrows to several rows; three rows carry a reference and four don't, so
// the backfill wizard sees a real queue.
const CORPUS_ROWS = [
  "Machado de Assis;1953;US;Dom Casmurro;Dom Casmurro;Helen Caldwell;Noonday Press;",
  "Machado de Assis;1952;US;Memórias Póstumas;Epitaph of a Small Winner;William Grossman;Noonday Press;",
  "Machado de Assis;1954;US;Quincas Borba;Philosopher or Dog?;Clotilde Wilson;Noonday Press;Caldwell, Helen. Machado de Assis.",
  "José de Alencar;1886;GB;Iracema;Iraçéma the Honey-Lips;Isabel Burton;Bickers & Son;Burton, Isabel. Preface, 1886.",
  "Jorge Amado;1962;US;Gabriela, Cravo e Canela;Gabriela, Clove and Cinnamon;James Taylor;Knopf;",
  "Clarice Lispector;1986;GB;A Hora da Estrela;The Hour of the Star;Giovanni Pontiero;Carcanet;Pontiero, Giovanni. Afterword.",
  "Graciliano Ramos;1965;US;Vidas Secas;Barren Lives;Ralph Dimmick;University of Texas Press;",
];
export const CORPUS_CSV = CORPUS_ROWS.join("\n") + "\n";
export const CORPUS_SIZE = CORPUS_ROWS.length; // 7
export const CORPUS_UNREFERENCED = 4; // rows with an empty references column

/** Seed the corpus by bulk-importing it through the admin CSV upload + submit. */
export async function seedCorpus(page: Page) {
  await signInAsAdmin(page);
  await page.goto("/admin/publications/new");

  await page.locator("#upload-csv").setInputFiles({
    name: "corpus.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(CORPUS_CSV),
  });

  await submitWorkspace(page, CORPUS_SIZE);
}
