import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import {
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
 * Locates the rows of the table that a chart carries for assistive technology,
 * by the chart's heading. The first row is the table's header.
 */
function tabled(page: Page, heading: string) {
  return page.getByRole("table", { name: heading }).getByRole("row");
}

test("the insights count what the database holds, and a search carries between them and the list", async ({
  page,
}) => {
  await seedCorpus(page);

  // The insights page does not require signing in.
  await signOut(page);

  await page.goto("/");
  await expectPublicationCount(page, 7);
  await page.getByRole("link", { name: "Insights" }).click();
  await expect(page).toHaveURL(/\/insights$/);

  await expect(figure(page, "Publications")).toHaveText("7");
  await expect(figure(page, "Works")).toHaveText("7");
  await expect(figure(page, "Original authors")).toHaveText("5");
  await expect(figure(page, "Translators")).toHaveText("7");
  await expect(figure(page, "Publishers")).toHaveText("5");
  await expect(figure(page, "Countries")).toHaveText("2");
  await expect(figure(page, "Years")).toHaveText("1886–1986");
  await expect(figure(page, "Cite a source")).toHaveText("3 of 7");

  // Each figure explains what it counts in a tooltip beside its term.
  await page.getByRole("button", { name: "About Works", exact: true }).hover();
  await expect(page.getByRole("tooltip")).toContainText(
    "An original Brazilian book",
  );

  // Every year from the first to the last, split by the two countries with the
  // most publications and everything else.
  const years = tabled(page, "Publications per year");
  await expect(years).toHaveCount(1986 - 1886 + 2);
  await expect(years.first()).toHaveText(
    "YearUnited StatesUnited KingdomElsewhereTotal",
  );
  await expect(years.filter({ hasText: /^1886/ })).toHaveText("18860101");
  await expect(years.filter({ hasText: /^1953/ })).toHaveText("19531001");

  // Every decade from the first to the last, including those with none. Each
  // work in the corpus has one publication, so each is a first translation.
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
  await expect(
    counted(page, "Most frequent author–translator pairs").first(),
  ).toHaveText("Clarice Lispector · Giovanni Pontiero1");
  await expect(counted(page, "Most translated authors").first()).toHaveText(
    "Machado de Assis3",
  );
  await expect(
    counted(page, "Publishers with the most publications").first(),
  ).toHaveText("Noonday Press3");
  await expect(counted(page, "Publications by country")).toHaveText([
    "United States5",
    "United Kingdom2",
  ]);

  // No work in the corpus has two translations, so that list is left out.
  await expect(
    page.getByRole("region", { name: "Works translated more than once" }),
  ).toHaveCount(0);

  // A search limits the counts to the publications it matches.
  const search = page.getByRole("textbox", { name: "Search publications" });
  await search.fill("Machado");
  await expect(page).toHaveURL(/\/insights\?search=Machado/);
  await expectMatchCount(page, 3);
  await expect(figure(page, "Publications")).toHaveText("3");
  await expect(figure(page, "Original authors")).toHaveText("1");
  await expect(figure(page, "Years")).toHaveText("1952–1954");
  // Each translator reads with the year of each of their publications.
  const translators = counted(page, "Translators with the most publications");
  await expect(translators).toHaveText([
    /^Clotilde Wilson1/,
    /^Helen Caldwell1/,
    /^William Grossman1/,
  ]);
  await expect(translators.first()).toContainText("1954 · 1 publication");

  // The link to the list keeps the search, and so does the link back.
  await page.getByRole("link", { name: "Publications", exact: true }).click();
  await expect(page).toHaveURL(/\/en\?search=Machado/);
  await expectMatchCount(page, 3);
  await expect(
    indexTable(page).getByRole("row").filter({ hasText: "Machado de Assis" }),
  ).toHaveCount(3);

  await page.getByRole("link", { name: "Insights" }).click();
  await expect(figure(page, "Publications")).toHaveText("3");

  // A search that matches nothing shows a message instead of the figures.
  await search.fill("zzzznomatchqqq");
  await expectMatchCount(page, 0);
  await expect(
    page.getByText(
      "No publications match this search, so there is nothing to count.",
    ),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "In figures" })).toHaveCount(0);
});

test("a work translated again is counted as a retranslation, and a translation published again as a reissue", async ({
  page,
}) => {
  await seedCorpus(page);

  // Adds John Gledson's Dom Casmurro, and Helen Caldwell's published again.
  // The corpus has Caldwell's of 1953.
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

  await page.goto("/insights");
  await expect(figure(page, "Publications")).toHaveText("9");
  await expect(figure(page, "Works")).toHaveText("7");
  await expect(figure(page, "Translators")).toHaveText("8");

  // The work has two translations, each at the year it was first published.
  const works = counted(page, "Works translated more than once");
  await expect(works).toHaveText([
    /^Dom Casmurro · Machado de Assis2 translations/,
  ]);
  await expect(works.first()).toContainText("1953 · Helen Caldwell");
  await expect(works.first()).toContainText("1997 · John Gledson");

  // Caldwell's of 1966 is a reissue, and Gledson's a retranslation.
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

  // The same timeline on the Portuguese page.
  await page.goto("/pt/insights");
  await expect(
    page
      .getByRole("region", { name: "Obras traduzidas mais de uma vez" })
      .getByRole("listitem"),
  ).toHaveText([/^Dom Casmurro · Machado de Assis2 traduções/]);
});
