import type { Meta, StoryObj } from "@storybook/react";
import { SETTLE } from "modules/publication/checks";
import {
  Publication,
  type Language,
  type PublicationError,
  type PublicationId,
} from "modules/publication/model";
import {
  publicationNotesFamily,
  resetAll,
  setAll,
} from "modules/publication/store";
import type { RichTextValue } from "modules/rich-text";
import { store } from "modules/store";
import { FC, useState } from "react";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import { item, paragraph } from "test/rich-text-fixtures";
import { editorOf, focusEditor } from "test/slate";
import { installFakeTranslator } from "test/translator";

import Button from "./Button";
import NotesField from "./NotesField";

// A mock called with the row's notes in each language each time they change
// in the store.
const written = fn();

// A mock of a Save button's click handler, called with the row's notes as the
// store holds them when the button is pressed.
const saved = fn();

// A mock called with the row's notes as the store holds them when Escape
// reaches the element around the field.
const escaped = fn();

/**
 * Returns a story's `beforeEach` that fills the store with one row, 1, holding
 * `notes` in each language and `errors`. Until the story ends, `written` is
 * called with the row's notes each time they change.
 */
const seed =
  (
    notes: Partial<Record<Language, RichTextValue | null>>,
    errors: PublicationError = null,
  ) =>
  () => {
    resetAll(store);
    written.mockClear();
    saved.mockClear();
    escaped.mockClear();
    setAll(store, [
      {
        id: 1,
        publication: {
          ...Publication.empty(),
          title: "Iracema",
          notesPt: notes.pt ?? null,
          notesEn: notes.en ?? null,
        },
        errors,
      },
    ]);

    return store.sub(publicationNotesFamily(1), () =>
      written(store.get(publicationNotesFamily(1))),
    );
  };

/**
 * Returns a story's `beforeEach` that runs `seed(notes)`, and installs the
 * fake Translator API (see `test/translator`) until the story ends.
 */
const seedWithTranslator =
  (notes: Partial<Record<Language, RichTextValue | null>>) => () => {
    const unseed = seed(notes)();
    const uninstall = installFakeTranslator();

    return () => {
      unseed();
      uninstall();
    };
  };

/**
 * The field until Escape is pressed in it, and then a line that says it
 * closed. The field unmounts with the focus still in it, as it does in a
 * dialog that Escape closes.
 */
const UntilEscape: FC<{ id: PublicationId }> = ({ id }) => {
  const [open, setOpen] = useState(true);

  return open ? (
    <div onKeyDown={(event) => event.key === "Escape" && setOpen(false)}>
      <NotesField id={id} />
    </div>
  ) : (
    <p>Closed</p>
  );
};

const meta = {
  title: "Publications/Notes field",
  component: NotesField,
  args: { id: 1 },
  decorators: [
    (Story) => (
      <div className="p-6 w-lg max-w-full bg-white rounded-lg border border-gray-200">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "centered" },
} satisfies Meta<typeof NotesField>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Returns the text area of the notes in `language`, once the field has
 * loaded. The English notes are the ones a reader of English sees first.
 */
const notesBox = (language = "English") =>
  screen.findByRole("textbox", { name: `Notes in ${language}` });

/** Returns the tab of `language` in the field's tab list. */
const tab = (name: string) =>
  within(
    screen.getByRole("tablist", { name: "Language of the notes" }),
  ).getByRole("tab", { name });

/** Waits a little longer than the field waits for the typing to pause. */
const pause = () => new Promise((resolve) => setTimeout(resolve, SETTLE + 100));

/**
 * A row without notes: the English tab is selected for a reader of English,
 * with the field's label, the hint that describes it, and the placeholder.
 */
export const Empty: Story = {
  beforeEach: seed({}),
  play: async () => {
    const box = await notesBox();

    await expect(tab("English")).toHaveAttribute("aria-selected", "true");
    await expect(box).toHaveAccessibleDescription(
      "Shown to everyone on the publication's page.",
    );
    await expect(
      await within(screen.getByRole("tabpanel")).findByText(
        "Notes about this publication",
      ),
    ).toBeVisible();
  },
};

/**
 * A row with notes in both languages: each tab opens on the notes of its
 * language, formatted. The play test reads the English notes, switches to the
 * Portuguese tab, and reads those.
 */
export const WithNotes: Story = {
  beforeEach: seed({
    en: [
      paragraph("Translated by ", { text: "Isabel Burton", bold: true }, "."),
      item("bulleted", 0, "Reprinted in 1922"),
    ],
    pt: [paragraph("Traduzido por ", { text: "Isabel Burton", bold: true })],
  }),
  play: async () => {
    await expect(editorOf(await notesBox()).children).toEqual([
      paragraph("Translated by ", { text: "Isabel Burton", bold: true }, "."),
      item("bulleted", 0, "Reprinted in 1922"),
    ]);

    await userEvent.click(tab("Português"));
    await expect(tab("Português")).toHaveAttribute("aria-selected", "true");
    await expect(editorOf(await notesBox("Portuguese")).children).toEqual([
      paragraph("Traduzido por ", { text: "Isabel Burton", bold: true }),
    ]);
  },
};

/**
 * Notes in Portuguese with an error, here for being too long, while the
 * English tab is selected: the Portuguese tab is shown in red, and the error
 * is under the Portuguese text.
 */
export const WithError: Story = {
  beforeEach: seed({ pt: [paragraph("Uma nota longa demais")] }, {
    notesPt: "too_long",
  } as PublicationError),
  play: async () => {
    await expect(tab("Português")).toHaveAttribute("data-invalid", "true");
    await expect(tab("English")).toHaveAttribute("data-invalid", "false");

    await userEvent.click(tab("Português"));
    const box = await notesBox("Portuguese");

    await expect(box).toHaveAttribute("aria-invalid", "true");
    await expect(box).toHaveAccessibleDescription(/This text is too long/);
  },
};

/**
 * Typing writes nothing to the row while it goes on. The play test types a
 * phrase and checks that the row's notes change once, to the whole phrase,
 * after the typing pauses.
 */
export const WrittenAfterAPause: Story = {
  beforeEach: seed({}),
  play: async () => {
    await focusEditor(await notesBox());
    await userEvent.keyboard("First edition");
    await expect(written).not.toHaveBeenCalled();

    await waitFor(() => expect(written).toHaveBeenCalledTimes(1));
    await expect(written).toHaveBeenCalledWith({
      pt: null,
      en: [paragraph("First edition")],
    });
  },
};

/**
 * Each language waits for its own pause. The play test types in English,
 * switches to Portuguese at once and types there, and checks that the row
 * holds both, so the switch did not drop the English edit.
 */
export const WrittenInBothLanguages: Story = {
  beforeEach: seed({}),
  play: async () => {
    await focusEditor(await notesBox());
    await userEvent.keyboard("First edition");
    await userEvent.click(tab("Português"));
    await focusEditor(await notesBox("Portuguese"));
    await userEvent.keyboard("Primeira edição");

    await waitFor(() =>
      expect(store.get(publicationNotesFamily(1))).toEqual({
        pt: [paragraph("Primeira edição")],
        en: [paragraph("First edition")],
      }),
    );
  },
};

/**
 * The field before a Save button, as in a form. The play test types and
 * presses Save at once, and checks that the row held the typed notes when Save
 * was pressed, and that they were written once.
 */
export const WrittenOnBlur: Story = {
  beforeEach: seed({}),
  decorators: [
    (Story) => (
      <div className="flex flex-col gap-4">
        <Story />
        <Button
          label="Save"
          width="fit"
          onClick={() => saved(store.get(publicationNotesFamily(1)))}
        />
      </div>
    ),
  ],
  play: async () => {
    await focusEditor(await notesBox());
    await userEvent.keyboard("Signed by the translator");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await expect(saved).toHaveBeenCalledWith({
      pt: null,
      en: [paragraph("Signed by the translator")],
    });
    await pause();
    await expect(written).toHaveBeenCalledTimes(1);
  },
};

/**
 * The field inside an element that reads the row when Escape reaches it, as a
 * dialog does that asks before it closes on an unsaved edit. The play test
 * types, presses Escape at once, and checks that the row held the typed notes
 * when the element read it, and that they were written once.
 */
export const WrittenOnEscape: Story = {
  beforeEach: seed({}),
  decorators: [
    (Story) => (
      <div
        onKeyDown={(event) =>
          event.key === "Escape" &&
          escaped(store.get(publicationNotesFamily(1)))
        }
      >
        <Story />
      </div>
    ),
  ],
  play: async () => {
    await focusEditor(await notesBox());
    await userEvent.keyboard("Signed by the translator");
    await expect(written).not.toHaveBeenCalled();

    await userEvent.keyboard("{Escape}");
    await expect(escaped).toHaveBeenCalledWith({
      pt: null,
      en: [paragraph("Signed by the translator")],
    });

    await pause();
    await expect(written).toHaveBeenCalledTimes(1);
  },
};

/**
 * The field closed while the focus is still in it, as Escape closes a dialog.
 * The play test types, presses Escape at once, and checks that the row's
 * notes were written once, when the field closed.
 */
export const WrittenOnClose: Story = {
  beforeEach: seed({}),
  render: (args) => <UntilEscape {...args} />,
  play: async () => {
    await focusEditor(await notesBox());
    await userEvent.keyboard("Signed by the translator");
    await expect(written).not.toHaveBeenCalled();

    await userEvent.keyboard("{Escape}");
    await expect(await screen.findByText("Closed")).toBeVisible();
    await expect(written).toHaveBeenCalledTimes(1);
    await expect(written).toHaveBeenCalledWith({
      pt: null,
      en: [paragraph("Signed by the translator")],
    });

    await pause();
    await expect(written).toHaveBeenCalledTimes(1);
  },
};

/**
 * In a browser that can translate, here with the fake Translator API, the
 * English tab drafts its notes from the Portuguese ones. The play test drafts
 * and checks that the draft is written to the row at once, with the blocks of
 * the Portuguese notes and their text translated.
 */
export const DraftedFromTheOtherLanguage: Story = {
  beforeEach: seedWithTranslator({
    pt: [
      paragraph("Um ", { text: "clássico", bold: true }, " do regionalismo."),
      item("bulleted", 0, "Reeditado em 1922"),
    ],
  }),
  play: async () => {
    await notesBox();
    await userEvent.click(
      await screen.findByRole("button", {
        name: "Draft the notes from Portuguese",
      }),
    );

    await waitFor(() =>
      expect(store.get(publicationNotesFamily(1)).en).toEqual([
        paragraph("[en] Um clássico do regionalismo."),
        item("bulleted", 0, "[en] Reeditado em 1922"),
      ]),
    );
    await expect(
      within(await notesBox()).getByText("[en] Reeditado em 1922"),
    ).toBeVisible();
  },
};
