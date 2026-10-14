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

test("an admin writes formatted comments that every reader sees, and a later save of the sources keeps them", async ({
  page,
}) => {
  await seedCorpus(page);
  await page.goto("/");

  const dialog = await openPublicationModal(page, "Barren Lives");
  const address = new URL(page.url()).pathname;
  await dialog.getByRole("button", { name: "Edit" }).click();

  // A paragraph with a bold word, set with the toolbar.
  const comments = dialog.getByRole("textbox", { name: "Comments" });
  const tool = (name: string) =>
    dialog
      .getByRole("toolbar", { name: "Formatting" })
      .getByRole("button", { name });

  await comments.click();
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

  // The record shows the comments as they were formatted.
  const shown = dialog.getByRole("region", { name: "Comments" });
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

  // The history records the change, with the comments rendered.
  await dialog.getByText("History", { exact: true }).click();
  const update = dialog.locator('li[data-action="updated"]');
  await expect(update).toContainText("Comments:");
  await expect(update.locator("ins strong")).toHaveText("regionalist");
  await expect(update.locator("del")).toHaveText("(none)");

  // Comments are not searchable: a word only they hold finds nothing.
  await page.keyboard.press("Escape");
  await page
    .getByRole("textbox", { name: "Search publications" })
    .fill("regionalist");
  await expect(
    page.getByText("No results found, try another query.").first(),
  ).toBeVisible();

  // The sources backfill saves the record it read from the index, which leaves
  // comments out. Adding a source keeps the comments.
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

  // A reader who is signed out sees the comments on the publication's page.
  await signOut(page);
  await page.goto(address);
  const region = page.getByRole("region", { name: "Comments" });
  await expect(region.locator("strong")).toHaveText("regionalist");
  await expect(
    region.getByRole("link", { name: "the Internet Archive" }),
  ).toHaveAttribute("href", "https://archive.org/details/barrenlives");
  await expect(
    page.getByText("Dimmick, Ralph. Translator's note, 1965."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit" })).toHaveCount(0);
});

test("comments come in with a CSV, are edited in the import document, and go out with the export", async ({
  page,
}) => {
  await signInAsAdmin(page);
  await openDocument(page);

  await uploadCsv(
    page,
    csv(
      [
        `Iracema,1886,GB,Bickers & Son,Isabel Burton,Iracema,José de Alencar,,${quoted("Translated in 1886. See [the scan](https://archive.org/details/iracema).")}`,
        `Dom Casmurro,1953,US,Noonday Press,Helen Caldwell,Dom Casmurro,Machado de Assis,,`,
        `Barren Lives,1965,US,University of Texas Press,Ralph Dimmick,Vidas Secas,Graciliano Ramos,,${quoted("Two editions:\n- *1965*, cloth\n- 1971, paper")}`,
      ],
      { comments: true },
    ),
  );

  const table = indexTable(page);
  const row = (title: string) =>
    table.getByRole("row", { name: new RegExp(`^${title}`) });

  // Each row's comments read as one line of text in its comments cell.
  await expect(
    row("Iracema").getByRole("button", {
      name: "Edit comments: Translated in 1886. See the scan.",
    }),
  ).toBeVisible();
  await expect(
    row("Barren Lives").getByRole("button", {
      name: "Edit comments: Two editions: 1965, cloth 1971, paper",
    }),
  ).toBeVisible();

  // The editor opens on the comments with their link.
  await row("Iracema")
    .getByRole("button", { name: /^Edit comments/ })
    .click();
  let editor = page.getByRole("dialog", { name: "Edit comments" });
  await expect(editor.getByRole("link", { name: "the scan" })).toHaveAttribute(
    "href",
    "https://archive.org/details/iracema",
  );
  await page.keyboard.press("Escape");
  await expect(editor).toHaveCount(0);

  // A row without comments gets them in its own editor, bold set with the
  // keyboard.
  await row("Dom Casmurro")
    .getByRole("button", { name: "Add comments" })
    .click();
  editor = page.getByRole("dialog", { name: "Edit comments" });
  await editor.getByRole("textbox", { name: "Comments" }).click();
  await page.keyboard.press("ControlOrMeta+b");
  await page.keyboard.type("Caldwell's own copy");
  await page.keyboard.press("ControlOrMeta+b");
  await page.keyboard.type(", with notes.");
  await page.keyboard.press("Escape");
  await expect(
    row("Dom Casmurro").getByRole("button", {
      name: "Edit comments: Caldwell's own copy, with notes.",
    }),
  ).toBeVisible();

  await submitWorkspace(page, 3);

  // The inserted publications show their comments.
  await page.goto("/");
  let publication = await openPublicationModal(page, "Iracema");
  await expect(
    publication.getByRole("link", { name: "the scan" }),
  ).toHaveAttribute("href", "https://archive.org/details/iracema");
  await page.keyboard.press("Escape");

  publication = await openPublicationModal(page, "Dom Casmurro");
  await expect(
    publication.getByRole("region", { name: "Comments" }).locator("strong"),
  ).toHaveText("Caldwell's own copy");
  await page.keyboard.press("Escape");

  publication = await openPublicationModal(page, "Barren Lives");
  const listed = publication
    .getByRole("region", { name: "Comments" })
    .getByRole("listitem");
  await expect(listed).toHaveText(["1965, cloth", "1971, paper"]);
  await page.keyboard.press("Escape");

  // The export carries every publication's comments as Markdown.
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

  expect(exported.split("\n")[0]).toMatch(/,comments$/);
  expect(exported).toContain(
    "Translated in 1886. See [the scan](https://archive.org/details/iracema).",
  );
  expect(exported).toContain("**Caldwell's own copy**, with notes.");
  expect(exported).toContain("- *1965*, cloth");
});
