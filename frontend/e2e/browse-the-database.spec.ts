import { test, expect } from "./fixtures";
import {
  openPublicationModal,
  signOut,
  seedCorpus,
  signInAsAdmin,
  submitWorkspace,
  indexTable,
  expectPublicationCount,
  CORPUS_SIZE,
  PAGED_CSV,
  PAGED_SIZE,
} from "./helpers";

// Browse / search / columns against a seeded corpus, all through the UI.
test("browse the corpus, search, and toggle a column", async ({ page }) => {
  await seedCorpus(page);

  await page.goto("/");
  const table = indexTable(page);

  // The whole corpus is listed.
  await expectPublicationCount(page, CORPUS_SIZE);
  await expect(table.getByText("Epitaph of a Small Winner")).toBeVisible();
  await expect(table.getByText("Barren Lives")).toBeVisible();

  const search = page.getByRole("textbox", { name: "Search publications" });

  // Searching an author narrows to their three works.
  await search.fill("Machado");
  await expect(
    table.getByRole("row").filter({ hasText: "Machado de Assis" }),
  ).toHaveCount(3);
  await expect(table.getByText("Iraçéma the Honey-Lips")).toHaveCount(0);
  await expect(page).toHaveURL(/\?search=Machado/);

  // A distinctive title narrows to one.
  await search.fill("Gabriela");
  await expect(table.getByText("Gabriela, Clove and Cinnamon")).toBeVisible();
  await expect(table.getByText("Epitaph of a Small Winner")).toHaveCount(0);

  // `:or` widens: either alternative matches, from the search bar directly.
  await search.fill("Amado :or Lispector");
  await expect(table.getByText("Gabriela, Clove and Cinnamon")).toBeVisible();
  await expect(table.getByText("The Hour of the Star")).toBeVisible();
  await expect(
    table.getByRole("row").filter({ hasText: "Machado de Assis" }),
  ).toHaveCount(0);

  // Clearing restores the full corpus.
  await search.fill("");
  await expect(table.getByText("Barren Lives")).toBeVisible();

  // The Columns menu hides the Year column across every row.
  await expect(table.getByRole("columnheader", { name: "Year" })).toBeVisible();
  await page.getByRole("button", { name: "Columns" }).click();
  await page.getByRole("button", { name: "Year", pressed: true }).click();
  await expect(table.getByRole("columnheader", { name: "Year" })).toHaveCount(
    0,
  );
});

test("a search that matches nothing shows the empty state, not an error", async ({
  page,
}) => {
  await seedCorpus(page);
  await page.goto("/");

  await page
    .getByRole("textbox", { name: "Search publications" })
    .fill("zzzznomatchqqq");

  // The corpus leaves the view and the empty state stands in — the query simply
  // answered nothing, which is a page to show, not a server error. (Both the
  // table and the list render it; one is hidden by breakpoint.)
  await expect(
    page.getByText("No results found, try another query.").first(),
  ).toBeVisible();
  await expect(indexTable(page).getByText("Dom Casmurro")).toHaveCount(0);
});

// A full page of distinct publications — enough to overflow a short viewport so
// the last rows sit below the fold, but no more than a page, so this exercises
// virtualization without also tripping the scroll-to-load-more (its own test).
// Titles carry the index so a far-away row is addressable.
const BULK_SIZE = 20;
const BULK_CSV =
  Array.from(
    { length: BULK_SIZE },
    (_, i) =>
      `Author ${i};${1900 + i};US;Original ${i};Bulk Title ${i};Translator ${i};Publisher ${i};`,
  ).join("\n") + "\n";

test("the database arrives with the page, not after it", async ({
  page,
  request,
  baseURL,
}) => {
  await seedCorpus(page);

  // The raw response, before any script has run: the rows a reader asked for
  // are already in it, and so is the count that goes with them.
  const html = await (await request.get(`${baseURL}/?search=Machado`)).text();

  expect(html).toContain("Dom Casmurro");
  expect(html).toContain("Epitaph of a Small Winner");
  expect(html).toContain("Showing results for");
  // A publication the query excludes is not in it — the server ran the search.
  expect(html).not.toContain("The Hour of the Star");
});

test("opening a publication does not read the database again", async ({
  page,
}) => {
  await seedCorpus(page);
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  const payloads: string[] = [];
  page.on("response", async (response) => {
    if (response.url().includes("_rsc")) {
      payloads.push(await response.text().catch(() => ""));
    }
  });

  await openPublicationModal(page, "Barren Lives");

  // The overlay is its own route, so what crossed the wire is the record — not
  // the rows it was opened from.
  expect(payloads.length).toBeGreaterThan(0);
  const sent = payloads.join("");
  expect(sent).toContain("Barren Lives");
  expect(sent).not.toContain("Iraçéma the Honey-Lips");

  // Closing goes back to a database that is still there, without asking again.
  payloads.length = 0;
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(indexTable(page).getByText("Barren Lives")).toBeVisible();
  expect(payloads).toHaveLength(0);
});

test("reloading with a publication open keeps it open, over the search that found it", async ({
  page,
}) => {
  await seedCorpus(page);
  await page.goto("/");

  await page
    .getByRole("textbox", { name: "Search publications" })
    .fill("Machado");
  // Wait for the query to actually land — the unfiltered database contains this
  // title too, so its presence proves nothing until the others are gone.
  await expect(indexTable(page).getByText("The Hour of the Star")).toHaveCount(
    0,
  );

  const dialog = await openPublicationModal(page, "Dom Casmurro");
  await expect(dialog).toBeVisible();

  // The address says what is being shown, and over what.
  await page.reload();

  const reopened = page.getByRole("dialog", { name: "Publication details" });
  await expect(reopened).toBeVisible();
  await expect(reopened.getByText(/is a translation of/)).toBeVisible();

  // Closing goes back to the search it was opened from, not to the whole
  // database — even though there is no history left to go back through. Right
  // after a reload the dialog paints before its key handler has hydrated, so the
  // first Escape can land on nothing; retry until the close registers.
  await expect(async () => {
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/\?search=Machado$/);
  }).toPass();
  await expect(indexTable(page).getByText("The Hour of the Star")).toHaveCount(
    0,
  );
});

test("a reader narrows a search with operators, in either language", async ({
  page,
}) => {
  await seedCorpus(page);
  await page.goto("/");

  const rows = indexTable(page).getByRole("row");
  const search = page.getByRole("textbox", { name: "Search publications" });

  // The name is the author's, not any title's — so asking it of the title
  // finds nothing while asking it of the author finds their three works.
  await search.fill("title:Machado");
  await expect(
    page.getByText("No results found, try another query.").first(),
  ).toBeVisible();

  await search.fill("autor:Machado");
  await expect(rows.filter({ hasText: "Machado de Assis" })).toHaveCount(3);

  // A span of years, and the same question in English and Portuguese.
  await search.fill("year:1952-1954");
  await expect(rows.filter({ hasText: "Machado de Assis" })).toHaveCount(3);
  await expect(rows.filter({ hasText: "Barren Lives" })).toHaveCount(0);

  await search.fill("ano:1952-1954");
  await expect(rows.filter({ hasText: "Machado de Assis" })).toHaveCount(3);

  // An operator narrows the words beside it, and a minus excludes.
  await search.fill("Machado -title:Casmurro");
  await expect(rows.filter({ hasText: "Dom Casmurro" })).toHaveCount(0);
  await expect(
    rows.filter({ hasText: "Epitaph of a Small Winner" }),
  ).toHaveCount(1);

  // Operators belong to their own alternative.
  await search.fill("country:GB :or editora:Knopf");
  await expect(rows.filter({ hasText: "The Hour of the Star" })).toHaveCount(1);
  await expect(
    rows.filter({ hasText: "Gabriela, Clove and Cinnamon" }),
  ).toHaveCount(1);
  await expect(rows.filter({ hasText: "Barren Lives" })).toHaveCount(0);
});

test("a reader can find out how to search, without losing the search", async ({
  page,
}) => {
  await seedCorpus(page);
  await page.goto("/?search=Machado");

  await page.getByRole("button", { name: "How to search" }).click();

  const help = page.getByRole("dialog", { name: "How to search" });
  await expect(help).toBeVisible();
  // The things a text box cannot advertise, and the operators it takes.
  await expect(help).toContainText("Accents may be omitted");
  await expect(help).toContainText("title:iracema");
  await expect(help).toContainText("autor:");

  // Reading the help does not throw away what was being searched.
  await page.keyboard.press("Escape");
  await expect(help).toHaveCount(0);
  await expect(page).toHaveURL(/\?search=Machado/);
  await expect(
    indexTable(page).getByRole("row").filter({ hasText: "Machado de Assis" }),
  ).toHaveCount(3);
});

test("a large index virtualizes: far rows render as they scroll into view", async ({
  page,
}) => {
  // Seeding this many rows through validate + bulk insert is the suite's
  // heaviest server work — give it triple the timeout for slow CI runners.
  test.slow();

  await signInAsAdmin(page);
  await page.goto("/admin/publications/new");
  await page.locator("#upload-csv").setInputFiles({
    name: "bulk.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(BULK_CSV),
  });
  await submitWorkspace(page, BULK_SIZE);

  // A viewport this many rows cannot fit, so the last row is below the fold
  // whatever the runner's default happens to be.
  await page.setViewportSize({ width: 1280, height: 400 });
  await page.goto("/");
  const table = indexTable(page);
  await expectPublicationCount(page, BULK_SIZE);

  // The row exists but is virtualized: its cells are empty placeholders until it
  // scrolls into view. Asked of the last row itself rather than of a title,
  // since which record sorts last is the index's business, not this test's.
  const lastRow = table.getByRole("row").last();
  await expect(lastRow).toHaveText("");
  await lastRow.scrollIntoViewIfNeeded();
  await expect(lastRow).not.toHaveText("");
});

test("a signed-out reader sees publication details read-only, references included", async ({
  page,
}) => {
  await seedCorpus(page);
  // Sign out from the home footer (the admin workspace footer has no session controls).
  await page.goto("/");
  await signOut(page);

  const dialog = await openPublicationModal(page, "The Hour of the Star");
  // Provenance is public: the reference shows in the read view…
  await expect(
    dialog.getByText("Pontiero, Giovanni. Afterword."),
  ).toBeVisible();
  // …but editing is admin-only.
  await expect(dialog.getByRole("button", { name: "Edit" })).toHaveCount(0);
});

test("a reader takes a publication's link, and the link stands on its own", async ({
  page,
}) => {
  await seedCorpus(page);
  await page.goto("/");
  // A reader, not an admin: the link is for everyone.
  await signOut(page);

  await page.context().grantPermissions(["clipboard-write"]);

  const dialog = await openPublicationModal(page, "The Hour of the Star");
  await dialog.getByRole("button", { name: "Copy link" }).click();

  // The confirmation carries the address it took, so the test can follow it
  // without reading the clipboard back.
  const notifications = page.locator("section[aria-label='Notifications']");
  await expect(notifications).toContainText(
    /Link copied[\s\S]*\/publications\/\d+/,
  );
  const link = (await notifications.innerText()).match(
    /\/publications\/\d+/,
  )![0];

  // It is a page, not the index with an overlay: the record is there and the
  // database behind it is not.
  await page.goto(link);
  await expect(page.getByText("The Hour of the Star").first()).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("Barren Lives")).toHaveCount(0);
});

test("a search link in an open publication takes the reader to that search", async ({
  page,
}) => {
  await seedCorpus(page);
  await page.goto("/");

  // Three of the corpus share this author, so the search has to narrow the
  // index rather than leave it whole.
  const dialog = await openPublicationModal(page, "Dom Casmurro");
  await dialog.getByRole("link", { name: "Machado de Assis" }).first().click();

  await expect(page).toHaveURL(
    /\?search=Machado\+de\+Assis|\?search=Machado%20de%20Assis/,
  );
  await expect(dialog).toHaveCount(0);

  const rows = indexTable(page).getByRole("row");
  await expect(rows.filter({ hasText: "Dom Casmurro" }).first()).toBeVisible();
  await expect(rows.filter({ hasText: "The Hour of the Star" })).toHaveCount(0);
});

test("a row answered by its sources says so", async ({ page }) => {
  await seedCorpus(page);
  // "Afterword" is in one publication's references and nowhere else in the
  // corpus, so the row it returns has nothing on it explaining why.
  await page.goto("/?search=Afterword");

  const row = indexTable(page)
    .getByRole("row")
    .filter({ hasText: "The Hour of the Star" })
    .first();

  await expect(row.locator("mark")).toHaveText("Afterword");
  await expect(row).toContainText("Pontiero");
});

test("the database grows as the reader scrolls to its foot", async ({
  page,
}) => {
  await signInAsAdmin(page);
  await page.goto("/admin/publications/new");
  await page.locator("#upload-csv").setInputFiles({
    name: "paged.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(PAGED_CSV),
  });
  await submitWorkspace(page, PAGED_SIZE);

  await page.goto("/");
  const rows = indexTable(page).getByRole("row");

  // The first page arrives with the page; the last record — beyond it — is not
  // loaded yet.
  await expect(rows.filter({ hasText: "Paged Work 00" })).toHaveCount(1);
  await expect(rows.filter({ hasText: "Paged Work 24" })).toHaveCount(0);

  // No page controls: the reader scrolls rather than steps.
  await expect(
    page.getByRole("button", { name: "Next", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText(/Page \d+ of \d+/)).toHaveCount(0);

  // Reaching the foot fetches the next page and appends it — the list grows.
  await expect(async () => {
    await page.mouse.move(600, 400);
    await page.mouse.wheel(0, 8000);
    await expect(rows.filter({ hasText: "Paged Work 24" })).toHaveCount(1, {
      timeout: 800,
    });
  }).toPass({ timeout: 15000 });

  // It grew rather than turned the page — the address never named a page.
  await expect(page).not.toHaveURL(/[?&]page=/);

  // The whole database is counted, however much of it has scrolled into view.
  await expectPublicationCount(page, PAGED_SIZE);
});
