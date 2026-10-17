import type { Meta, StoryObj } from "@storybook/react";
import { SETTLE } from "modules/publication/checks";
import {
  Publication,
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
import { expect, fn, screen, userEvent, waitFor } from "storybook/test";
import { item, paragraph } from "test/rich-text-fixtures";
import { editorOf, focusEditor } from "test/slate";

import Button from "./Button";
import NotesField from "./NotesField";

// A mock called with the row's notes each time they change in the store.
const written = fn();

// A mock of a Save button's click handler, called with the row's notes as the
// store holds them when the button is pressed.
const saved = fn();

// A mock called with the row's notes as the store holds them when Escape
// reaches the element around the field.
const escaped = fn();

/**
 * Returns a story's `beforeEach` that fills the store with one row, 1, holding
 * `notes` and `errors`. Until the story ends, `written` is called with the
 * row's notes each time they change.
 */
const seed =
  (notes: RichTextValue | null, errors: PublicationError = null) =>
  () => {
    resetAll(store);
    written.mockClear();
    saved.mockClear();
    escaped.mockClear();
    setAll(store, [
      {
        id: 1,
        publication: { ...Publication.empty(), title: "Iracema", notes },
        errors,
      },
    ]);

    return store.sub(publicationNotesFamily(1), () =>
      written(store.get(publicationNotesFamily(1))),
    );
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

/** Returns the field's text area, once the field has loaded. */
const notesBox = () => screen.findByRole("textbox", { name: "Notes" });

/** Waits a little longer than the field waits for the typing to pause. */
const pause = () => new Promise((resolve) => setTimeout(resolve, SETTLE + 100));

/**
 * A row without notes: the field's label, the hint that describes it, and the
 * placeholder.
 */
export const Empty: Story = {
  beforeEach: seed(null),
  play: async () => {
    await expect(await notesBox()).toHaveAccessibleDescription(
      "Shown to everyone on the publication's page.",
    );
    await expect(
      await screen.findByText("Notes about this publication"),
    ).toBeVisible();
  },
};

/** A row with notes: the field opens on them, formatted. */
export const WithNotes: Story = {
  beforeEach: seed([
    paragraph("Translated by ", { text: "Isabel Burton", bold: true }, "."),
    item("bulleted", 0, "Reprinted in 1922"),
  ]),
  play: async () => {
    await expect(editorOf(await notesBox()).children).toEqual([
      paragraph("Translated by ", { text: "Isabel Burton", bold: true }, "."),
      item("bulleted", 0, "Reprinted in 1922"),
    ]);
  },
};

/** Notes with an error, here for being too long: the error is under the text. */
export const WithError: Story = {
  beforeEach: seed([paragraph("A very long note")], {
    notes: "too_long",
  } as PublicationError),
  play: async () => {
    const box = await notesBox();

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
  beforeEach: seed(null),
  play: async () => {
    await focusEditor(await notesBox());
    await userEvent.keyboard("First edition");
    await expect(written).not.toHaveBeenCalled();

    await waitFor(() => expect(written).toHaveBeenCalledTimes(1));
    await expect(written).toHaveBeenCalledWith([paragraph("First edition")]);
  },
};

/**
 * The field before a Save button, as in a form. The play test types and
 * presses Save at once, and checks that the row held the typed notes when Save
 * was pressed, and that they were written once.
 */
export const WrittenOnBlur: Story = {
  beforeEach: seed(null),
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

    await expect(saved).toHaveBeenCalledWith([
      paragraph("Signed by the translator"),
    ]);
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
  beforeEach: seed(null),
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
    await expect(escaped).toHaveBeenCalledWith([
      paragraph("Signed by the translator"),
    ]);

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
  beforeEach: seed(null),
  render: (args) => <UntilEscape {...args} />,
  play: async () => {
    await focusEditor(await notesBox());
    await userEvent.keyboard("Signed by the translator");
    await expect(written).not.toHaveBeenCalled();

    await userEvent.keyboard("{Escape}");
    await expect(await screen.findByText("Closed")).toBeVisible();
    await expect(written).toHaveBeenCalledTimes(1);
    await expect(written).toHaveBeenCalledWith([
      paragraph("Signed by the translator"),
    ]);

    await pause();
    await expect(written).toHaveBeenCalledTimes(1);
  },
};
