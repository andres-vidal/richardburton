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

/** The value of one headline figure, found by its term. */
function figure(page: Page, term: string) {
  return page
    .getByRole("region", { name: "In figures" })
    .locator("div")
    .filter({
      has: page.getByRole("term").filter({ hasText: new RegExp(`^${term}$`) }),
    })
    .getByRole("definition");
}

/** The entries of one of the counted lists, found by its heading. */
function counted(page: Page, heading: string) {
  return page.getByRole("region", { name: heading }).getByRole("listitem");
}

test("the insights count what the database holds, and a search carries between them and the list", async ({
  page,
}) => {
  await seedCorpus(page);

  // Anybody may read them.
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

  // Every decade from the first to the last, the quiet ones included.
  await expect(counted(page, "Publications by decade")).toHaveText([
    "1880s1",
    "1890s0",
    "1900s0",
    "1910s0",
    "1920s0",
    "1930s0",
    "1940s0",
    "1950s3",
    "1960s2",
    "1970s0",
    "1980s1",
  ]);
  await expect(counted(page, "Most translated authors").first()).toHaveText(
    "Machado de Assis3",
  );
  await expect(
    counted(page, "Publishers with the most publications").first(),
  ).toHaveText("Noonday Press3");
  await expect(counted(page, "Countries of publication")).toHaveText([
    "United States5",
    "United Kingdom2",
  ]);

  // No work in the corpus has been translated twice, so there is no list of them.
  await expect(
    page.getByRole("region", { name: "Works translated more than once" }),
  ).toHaveCount(0);

  // A search narrows what is counted.
  const search = page.getByRole("textbox", { name: "Search publications" });
  await search.fill("Machado");
  await expect(page).toHaveURL(/\/insights\?search=Machado/);
  await expectMatchCount(page, 3);
  await expect(figure(page, "Publications")).toHaveText("3");
  await expect(figure(page, "Original authors")).toHaveText("1");
  await expect(figure(page, "Years")).toHaveText("1952–1954");
  await expect(
    counted(page, "Translators with the most publications"),
  ).toHaveText(["Clotilde Wilson1", "Helen Caldwell1", "William Grossman1"]);

  // The list reads the same search, and the insights read it back.
  await page.getByRole("link", { name: "Publications", exact: true }).click();
  await expect(page).toHaveURL(/\/en\?search=Machado/);
  await expectMatchCount(page, 3);
  await expect(
    indexTable(page).getByRole("row").filter({ hasText: "Machado de Assis" }),
  ).toHaveCount(3);

  await page.getByRole("link", { name: "Insights" }).click();
  await expect(figure(page, "Publications")).toHaveText("3");

  // A search that matches nothing leaves nothing to count.
  await search.fill("zzzznomatchqqq");
  await expectMatchCount(page, 0);
  await expect(
    page.getByText(
      "No publications match this search, so there is nothing to count.",
    ),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "In figures" })).toHaveCount(0);
});

test("a work translated again is counted as a retranslation, not as another work", async ({
  page,
}) => {
  await seedCorpus(page);

  // John Gledson's Dom Casmurro, forty-four years after Helen Caldwell's.
  await openDocument(page, "Retranslations");
  await uploadCsv(
    page,
    [
      CSV_HEADER,
      `Dom Casmurro,1997,GB,Oxford University Press,John Gledson,Dom Casmurro,Machado de Assis,`,
    ].join("\n") + "\n",
    "retranslations.csv",
  );
  await submitWorkspace(page, 1);

  await page.goto("/insights");
  await expect(figure(page, "Publications")).toHaveText("8");
  await expect(figure(page, "Works")).toHaveText("7");
  await expect(figure(page, "Translators")).toHaveText("8");
  await expect(counted(page, "Works translated more than once")).toHaveText([
    "Dom Casmurro · Machado de Assis2 translations",
  ]);

  // The same, read in Portuguese.
  await page.goto("/pt/insights");
  await expect(
    page
      .getByRole("region", { name: "Obras traduzidas mais de uma vez" })
      .getByRole("listitem"),
  ).toHaveText(["Dom Casmurro · Machado de Assis2 traduções"]);
});
