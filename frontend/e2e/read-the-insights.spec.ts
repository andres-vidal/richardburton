import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import {
  chooseOption,
  CORPUS_SIZE,
  CORPUS_UNSOURCED,
  CSV_HEADER,
  expectMatchCount,
  expectPublicationCount,
  indexTable,
  openDocument,
  seedCorpus,
  signOut,
  submitWorkspace,
  uploadCsv,
} from "./helpers";

/** Locates the value of one figure in "In figures" by its term. */
function figure(page: Page, term: string) {
  return page
    .getByRole("region", { name: "In figures" })
    .locator("div")
    .filter({
      has: page.getByRole("term").filter({ hasText: new RegExp(`^${term}$`) }),
    })
    .getByRole("definition");
}

/** Locates the items of one list of counts by its heading. */
function counted(page: Page, heading: string) {
  return page.getByRole("region", { name: heading }).getByRole("listitem");
}

/**
 * Locates the rows of the table that a chart carries, by the chart's heading.
 * The first row is the table's header.
 */
function tabled(page: Page, heading: string) {
  return page.getByRole("table", { name: heading }).getByRole("row");
}

/** Chooses the preset named `name`, and waits for its chart. */
async function choosePreset(page: Page, name: string) {
  await chooseOption(page, "Preset", name);
  await expect(page.getByRole("region", { name })).toBeVisible();
}

/**
 * Adds John Gledson's Dom Casmurro, a second translation of the work, and
 * Helen Caldwell's published again in 1966. The corpus has Caldwell's of 1953.
 */
async function addRetranslations(page: Page) {
  await openDocument(page, "Retranslations");
  await uploadCsv(
    page,
    [
      CSV_HEADER,
      `Dom Casmurro,1997,GB,Oxford University Press,John Gledson,Dom Casmurro,Machado de Assis,`,
      `Dom Casmurro,1966,US,University of California Press,Helen Caldwell,Dom Casmurro,Machado de Assis,`,
    ].join("\n") + "\n",
    "retranslations.csv",
  );
  await submitWorkspace(page, 2);
}

test("the insights count what the database holds in every preset, and a search carries between them and the list", async ({
  page,
}) => {
  await seedCorpus(page);

  // The insights page does not require signing in.
  await signOut(page);

  await page.goto("/");
  await expectPublicationCount(page, CORPUS_SIZE);
  await page.getByRole("link", { name: "Insights" }).click();
  await expect(page).toHaveURL(/\/insights$/);

  await expect(figure(page, "Publications")).toHaveText(String(CORPUS_SIZE));
  await expect(figure(page, "Works")).toHaveText("7");
  await expect(figure(page, "Original authors")).toHaveText("5");
  await expect(figure(page, "Translators")).toHaveText("7");
  await expect(figure(page, "Publishers")).toHaveText("5");
  await expect(figure(page, "Countries")).toHaveText("2");
  await expect(figure(page, "Years")).toHaveText("1886–1986");
  await expect(figure(page, "Cite a source")).toHaveText(
    `${CORPUS_SIZE - CORPUS_UNSOURCED} of ${CORPUS_SIZE}`,
  );

  // Each figure explains what it counts in a tooltip beside its term.
  await page.getByRole("button", { name: "About Works", exact: true }).hover();
  await expect(page.getByRole("tooltip")).toContainText(
    "An original Brazilian book",
  );

  // The page opens on the first preset: every year from the first to the
  // last, split by the two countries with the most publications and
  // everything else.
  await expect(page.getByLabel("Preset", { exact: true })).toHaveValue(
    "Publications per year",
  );
  const years = tabled(page, "Publications per year");
  await expect(years).toHaveCount(1986 - 1886 + 2);
  await expect(years.first()).toHaveText(
    "YearUnited StatesUnited KingdomElsewhereTotal",
  );
  await expect(years.filter({ hasText: /^1886/ })).toHaveText("18860101");
  await expect(years.filter({ hasText: /^1953/ })).toHaveText("19531001");

  // Every decade from the first to the last, including those with none. Each
  // work in the corpus has one publication, so each is a first translation.
  await choosePreset(page, "Publications by decade");
  await expect(page).toHaveURL(/by=decade&split=kind&form=bars/);
  await expect(tabled(page, "Publications by decade")).toHaveText([
    "DecadeFirst translationsRetranslationsReissuesTotal",
    "1880s1001",
    "1890s0000",
    "1900s0000",
    "1910s0000",
    "1920s0000",
    "1930s0000",
    "1940s0000",
    "1950s3003",
    "1960s2002",
    "1970s0000",
    "1980s1001",
  ]);

  // Jorge Amado and Graciliano Ramos were both first translated in the 1960s.
  await choosePreset(page, "Authors first translated, by decade");
  await expect(counted(page, "Authors first translated, by decade")).toHaveText(
    [
      "1880s1",
      "1890s0",
      "1900s0",
      "1910s0",
      "1920s0",
      "1930s0",
      "1940s0",
      "1950s1",
      "1960s2",
      "1970s0",
      "1980s1",
    ],
  );

  await choosePreset(page, "Most frequent author–translator pairs");
  await expect(
    counted(page, "Most frequent author–translator pairs").first(),
  ).toHaveText("Clarice Lispector · Giovanni Pontiero1");

  await choosePreset(page, "Most translated authors");
  await expect(counted(page, "Most translated authors").first()).toHaveText(
    "Machado de Assis3",
  );

  await choosePreset(page, "Publishers with the most publications");
  await expect(
    counted(page, "Publishers with the most publications").first(),
  ).toHaveText("Noonday Press3");

  await choosePreset(page, "Publications by country");
  await expect(counted(page, "Publications by country")).toHaveText([
    "United States5",
    "United Kingdom2",
  ]);

  // No work in the corpus has two translations, so that chart has nothing.
  await choosePreset(page, "Works translated more than once");
  await expect(
    page
      .getByRole("region", { name: "Works translated more than once" })
      .getByText("Nothing to show with these settings."),
  ).toBeVisible();

  // A search limits the counts to the publications it matches, and keeps the
  // chart.
  await choosePreset(page, "Translators with the most publications");
  const search = page.getByRole("textbox", { name: "Search publications" });
  await search.fill("Machado");
  await expect(page).toHaveURL(/by=translator.*search=Machado/);
  await expectMatchCount(page, 3);
  await expect(figure(page, "Publications")).toHaveText("3");
  await expect(figure(page, "Original authors")).toHaveText("1");
  await expect(figure(page, "Years")).toHaveText("1952–1954");
  // Each translator reads with the title of each of their publications.
  const translators = counted(page, "Translators with the most publications");
  await expect(translators).toHaveText([
    /^Clotilde Wilson1 publication/,
    /^Helen Caldwell1 publication/,
    /^William Grossman1 publication/,
  ]);
  await expect(translators.first()).toContainText("1954 · Philosopher or Dog?");

  // The link to the list keeps the search, and so does the link back, which
  // opens on the first preset.
  await page.getByRole("link", { name: "Publications", exact: true }).click();
  await expect(page).toHaveURL(/\/en\?search=Machado$/);
  await expectMatchCount(page, 3);
  await expect(
    indexTable(page).getByRole("row").filter({ hasText: "Machado de Assis" }),
  ).toHaveCount(3);

  // Every publication of Machado de Assis is in the United States, so the
  // chart has one leading country and everything else.
  await page.getByRole("link", { name: "Insights" }).click();
  await expect(figure(page, "Publications")).toHaveText("3");
  await expect(tabled(page, "Publications per year")).toHaveText([
    "YearUnited StatesElsewhereTotal",
    "1952101",
    "1953101",
    "1954101",
  ]);

  // A search that matches nothing shows a message instead of the figures and
  // the chart builder.
  await search.fill("zzzznomatchqqq");
  await expectMatchCount(page, 0);
  await expect(
    page.getByText(
      "No publications match this search, so there is nothing to count.",
    ),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "In figures" })).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "What the chart shows" }),
  ).toHaveCount(0);
});

test("a work translated again is counted as a retranslation, and a translation published again as a reissue", async ({
  page,
}) => {
  await seedCorpus(page);
  await addRetranslations(page);

  await page.goto("/insights");
  await expect(figure(page, "Publications")).toHaveText("9");
  await expect(figure(page, "Works")).toHaveText("7");
  await expect(figure(page, "Translators")).toHaveText("8");

  // The work has two translations, each at the year it was first published.
  await choosePreset(page, "Works translated more than once");
  const works = counted(page, "Works translated more than once");
  await expect(works).toHaveText([
    /^Dom Casmurro · Machado de Assis2 translations/,
  ]);
  await expect(works.first()).toContainText("1953 · Helen Caldwell");
  await expect(works.first()).toContainText("1997 · John Gledson");

  // Caldwell's of 1966 is a reissue, and Gledson's a retranslation.
  await choosePreset(page, "Publications by decade");
  const decades = tabled(page, "Publications by decade");
  await expect(decades.filter({ hasText: /^1960s/ })).toHaveText("1960s2013");
  await expect(decades.filter({ hasText: /^1990s/ })).toHaveText("1990s0101");

  // A search that matches only the reissue still counts it as one, since
  // the 1953 edition is in the database.
  const search = page.getByRole("textbox", { name: "Search publications" });
  await search.fill("California");
  await expect(figure(page, "Publications")).toHaveText("1");
  await expect(tabled(page, "Publications by decade")).toHaveText([
    "DecadeFirst translationsRetranslationsReissuesTotal",
    "1960s0011",
  ]);

  // The same timeline on the Portuguese page, opened from its address.
  await page.goto(
    "/pt/insights?count=translations&by=work&form=timeline&top=10&least=2",
  );
  await expect(page.getByLabel("Modelo", { exact: true })).toHaveValue(
    "Obras traduzidas mais de uma vez",
  );
  await expect(
    page
      .getByRole("region", { name: "Obras traduzidas mais de uma vez" })
      .getByRole("listitem"),
  ).toHaveText([/^Dom Casmurro · Machado de Assis2 traduções/]);
});

test("a reader builds a chart of their own, narrows it with a search, and shares its address", async ({
  page,
  context,
}) => {
  await seedCorpus(page);
  await addRetranslations(page);
  await signOut(page);

  await page.goto("/insights");
  await expect(figure(page, "Translators")).toHaveText("8");

  // Translators by original author. Machado de Assis has four: Helen
  // Caldwell, William Grossman, Clotilde Wilson and John Gledson. A count
  // other than publications takes no split, and is not grouped by country,
  // which belongs to a publication.
  await chooseOption(page, "What to count", "Translators");
  await chooseOption(page, "Group by", "by original author");
  await expect(page).toHaveURL(
    /count=translators&by=original_author&form=bars$/,
  );
  await expect(page.getByLabel("Split by", { exact: true })).toBeDisabled();
  await page.getByLabel("Group by", { exact: true }).click();
  await expect(page.getByRole("option")).toHaveText([
    "by year",
    "by decade",
    "by original author",
    "by work",
  ]);
  await page.keyboard.press("Escape");
  const byAuthor = "Translators by original author";
  await expect(
    counted(page, byAuthor).filter({ hasText: /^Machado de Assis/ }),
  ).toHaveText("Machado de Assis4");

  // The table view shows the same counts on screen, without changing the
  // address.
  const address = page.url();
  await page.getByRole("button", { name: "Table", exact: true }).click();
  await expect(
    tabled(page, byAuthor).filter({ hasText: /^Machado de Assis/ }),
  ).toHaveText("Machado de Assis4");
  expect(page.url()).toBe(address);
  await page.getByRole("button", { name: "Chart", exact: true }).click();

  // A timeline places each translator at the first year they translated the
  // author, so Caldwell's reissue of 1966 is not a dot of its own. Keeping
  // only authors with at least two translators leaves Machado de Assis alone.
  await chooseOption(page, "Show as", "as timeline");
  await expect(page).toHaveURL(/form=timeline/);
  const firsts = "Translators by original author, first appearances only";
  const machado = counted(page, firsts).filter({
    hasText: /^Machado de Assis/,
  });
  await expect(machado).toHaveText(/^Machado de Assis4 translators/);
  await expect(machado).toContainText("1953 · Helen Caldwell");
  await expect(machado).toContainText("1997 · John Gledson");
  await expect(machado).not.toContainText("1966");

  await page.getByRole("button", { name: `About ${firsts}` }).hover();
  await expect(page.getByRole("tooltip")).toContainText(
    "where it first appears in the database",
  );

  await chooseOption(page, "Fewest items per group", "At least 2");
  await expect(counted(page, firsts)).toHaveCount(1);

  // The copied link opens the same chart in a new tab.
  await context.grantPermissions(["clipboard-write"]);
  await page.getByRole("button", { name: "Copy link" }).click();
  const notifications = page.locator("section[aria-label='Notifications']");
  await expect(notifications).toContainText(/Link copied[\s\S]*\/insights\?/);
  const link = (await notifications.innerText()).match(
    /\/en\/insights\?\S+/,
  )![0];
  expect(link).toContain("form=timeline&least=2");

  const shared = await context.newPage();
  await shared.goto(link);
  await expect(counted(shared, firsts)).toHaveText([
    /^Machado de Assis4 translators/,
  ]);
  await shared.close();

  // A search keeps the chart. Only John Gledson matches, so no author has two
  // translators.
  const search = page.getByRole("textbox", { name: "Search publications" });
  await search.fill("Gledson");
  await expect(page).toHaveURL(/least=2.*search=Gledson/);
  await expect(figure(page, "Translators")).toHaveText("1");
  await expect(
    page
      .getByRole("region", { name: firsts })
      .getByText("Nothing to show with these settings."),
  ).toBeVisible();
  await search.fill("");
  await expect(figure(page, "Translators")).toHaveText("8");

  // The running total of translators by decade ends at the number of
  // translators in the database.
  await chooseOption(page, "Group by", "by decade");
  await chooseOption(page, "Show as", "as running total");
  await expect(
    tabled(page, "Translators by decade, running total").last(),
  ).toHaveText("1990s8");

  // A heat table of publications by original author, by decade.
  await chooseOption(page, "What to count", "Publications");
  await chooseOption(page, "Group by", "by original author");
  await chooseOption(page, "Show as", "as heat table by decade");
  const heat = page.getByRole("table", {
    name: "Publications by original author",
  });
  await expect(heat.getByRole("columnheader").nth(1)).toHaveText("1880s");
  // Machado de Assis has three publications in the 1950s, Caldwell's reissue
  // in the 1960s and Gledson's retranslation in the 1990s.
  await expect(
    heat
      .getByRole("row")
      .filter({ hasText: /^Machado de Assis/ })
      .getByRole("cell"),
  ).toHaveText(["", "", "", "", "", "", "", "3", "1", "", "", "1"]);
});
