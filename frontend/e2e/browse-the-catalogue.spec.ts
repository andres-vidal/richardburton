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

// Enough distinct publications to far overflow the viewport (~18 visible rows),
// imported in one shot; titles carry the index so a far-away row is addressable.
// Kept moderate on purpose: the backend validates rows sequentially, so seeding
// cost scales linearly and CI runners are slow.
const BULK_SIZE = 30;
const BULK_CSV =
  Array.from(
    { length: BULK_SIZE },
    (_, i) =>
      `Author ${i};${1900 + i};US;Original ${i};Bulk Title ${i};Translator ${i};Publisher ${i};`,
  ).join("\n") + "\n";

test("the catalogue arrives with the page, not after it", async ({
  page,
  request,
  baseURL,
}) => {
  await seedCorpus(page);

  // The raw response, before any script has run: the rows a reader asked for are
  // already in it, and so is the count that goes with them. The index used to
  // render a skeleton and fetch itself once the page was up.
  const html = await (await request.get(`${baseURL}/?search=Machado`)).text();

  expect(html).toContain("Dom Casmurro");
  expect(html).toContain("Epitaph of a Small Winner");
  expect(html).toContain("Showing results for");
  // A publication the query excludes is not in it — the server ran the search.
  expect(html).not.toContain("The Hour of the Star");
});

test("opening a publication does not read the catalogue again", async ({
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
  // the rows it was opened from. While it was a query on the catalogue's route,
  // every open re-read and re-sent all of them.
  expect(payloads.length).toBeGreaterThan(0);
  const sent = payloads.join("");
  expect(sent).toContain("Barren Lives");
  expect(sent).not.toContain("Iraçéma the Honey-Lips");

  // Closing goes back to a catalogue that is still there, without asking again.
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
  // Wait for the query to actually land — the unfiltered catalogue contains this
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
  // catalogue — even though there is no history left to go back through.
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/\?search=Machado$/);
  await expect(indexTable(page).getByText("The Hour of the Star")).toHaveCount(
    0,
  );
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
  await page.setViewportSize({ width: 1280, height: 600 });
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
  // catalogue behind it is not.
  await page.goto(link);
  await expect(page.getByText("The Hour of the Star").first()).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("Barren Lives")).toHaveCount(0);
});
