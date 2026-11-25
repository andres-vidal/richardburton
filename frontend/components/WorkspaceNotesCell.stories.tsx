import type { Meta, StoryObj } from "@storybook/react";
import { store, type Store } from "modules/store";
import {
  Publication,
  type Language,
  type PublicationError,
} from "modules/publication/model";
import { publicationFamily, resetAll, setAll } from "modules/publication/store";
import type { RichTextValue } from "modules/rich-text";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import { item, link, paragraph } from "test/rich-text-fixtures";
import { focusEditor } from "test/slate";

import WorkspaceNotesCell from "./WorkspaceNotesCell";

// A mock of the row's click handler, which selects the row in the workspace.
const selectRow = fn();

// Fills the store with one row, `rowId`, holding `notes` in each language and
// `errors`.
const seed = (
  store: Store,
  rowId: number,
  notes: Partial<Record<Language, RichTextValue | null>>,
  errors: PublicationError = null,
) => {
  resetAll(store);
  selectRow.mockClear();
  setAll(store, [
    {
      id: rowId,
      publication: {
        ...Publication.empty(),
        title: "Iracema",
        notesPt: notes.pt ?? null,
        notesEn: notes.en ?? null,
      },
      errors,
    },
  ]);
};

const meta = {
  title: "Publications/Workspace notes cell",
  component: WorkspaceNotesCell,
  args: { rowId: 1 },
  decorators: [
    (Story) => (
      <div role="table">
        <div role="row" onClick={selectRow}>
          <Story />
        </div>
      </div>
    ),
  ],
  parameters: {
    layout: "centered",
    // The open modal aria-hides the background trigger, which is still
    // focusable.
    a11y: { config: { rules: [{ id: "aria-hidden-focus", enabled: false }] } },
  },
} satisfies Meta<typeof WorkspaceNotesCell>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * A row without notes: the button reads "Notes" and is named "Add
 * notes". Pressing it opens the editor in a dialog without selecting the
 * row.
 */
export const Empty: Story = {
  beforeEach: () => seed(store, 1, {}),
  play: async () => {
    const button = screen.getByRole("button", { name: "Add notes" });
    await expect(button).toHaveTextContent("Notes");

    await userEvent.click(button);
    const dialog = await screen.findByRole("dialog", { name: "Edit notes" });
    await expect(
      await within(dialog).findByRole("textbox", { name: "Notes in English" }),
    ).toBeInTheDocument();
    await expect(selectRow).not.toHaveBeenCalled();
  },
};

/**
 * A row with notes: the button shows them as one line of plain text, cut
 * short to fit the cell, and is named with the whole of it. It shows the
 * notes in English, the reader's language, rather than those in Portuguese.
 */
export const WithNotes: Story = {
  beforeEach: () =>
    seed(store, 1, {
      pt: [paragraph("Traduzido por Isabel Burton.")],
      en: [
        paragraph(
          "Translated by ",
          { text: "Isabel Burton", bold: true },
          ". See ",
          link("https://archive.org/details/iracema", "the scan"),
          " for the plates.",
        ),
        item("bulleted", 0, "Reviewed in ", {
          text: "The Athenaeum",
          italic: true,
        }),
        item("bulleted", 0, "Reprinted in 1922"),
      ],
    }),
  play: async () => {
    await expect(
      screen.getByRole("button", {
        name: "Edit notes: Translated by Isabel Burton. See the scan for the plates. Reviewed in The Athenaeum Reprinted in 1922",
      }),
    ).toBeInTheDocument();
  },
};

/**
 * Editing in the dialog writes the notes' value to the row once the typing
 * pauses, and the button shows the new text once the dialog closes.
 */
export const Editing: Story = {
  beforeEach: () => seed(store, 1, {}),
  play: async () => {
    await userEvent.click(screen.getByRole("button", { name: "Add notes" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit notes" });

    await focusEditor(
      await within(dialog).findByRole("textbox", { name: "Notes in English" }),
    );
    await userEvent.click(within(dialog).getByRole("button", { name: "Bold" }));
    await userEvent.keyboard("First edition");

    await waitFor(() =>
      expect(store.get(publicationFamily(1)).notesEn).toEqual([
        paragraph({ text: "First edition", bold: true }),
      ]),
    );

    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Edit notes: First edition" }),
      ).toBeVisible(),
    );
  },
};

/**
 * Notes the server refused, here for being too long: the editor shows the
 * error under the text.
 */
export const TooLong: Story = {
  beforeEach: () =>
    seed(store, 1, { en: [paragraph("A very long note")] }, {
      notesEn: "too_long",
    } as PublicationError),
  play: async () => {
    await userEvent.click(
      screen.getByRole("button", { name: "Edit notes: A very long note" }),
    );
    const dialog = await screen.findByRole("dialog", { name: "Edit notes" });

    await expect(
      await within(dialog).findByRole("textbox", { name: "Notes in English" }),
    ).toHaveAccessibleDescription(/This text is too long/);
  },
};

/**
 * A row with notes only in Portuguese: the button shows those, since the row
 * has none in English, the reader's language.
 */
export const NotesInTheOtherLanguage: Story = {
  beforeEach: () =>
    seed(store, 1, { pt: [paragraph("Traduzido por Isabel Burton.")] }),
  play: async () => {
    await expect(
      screen.getByRole("button", {
        name: "Edit notes: Traduzido por Isabel Burton.",
      }),
    ).toBeInTheDocument();
  },
};
