import type { Meta, StoryObj } from "@storybook/react";
import { http } from "app";
import { ApiError } from "modules/http";
import { empty, type Publication } from "modules/publication/model";
import type { RichTextValue } from "modules/rich-text";
import { Transforms } from "slate";
import {
  expect,
  fn,
  screen,
  spyOn,
  userEvent,
  waitFor,
  within,
} from "storybook/test";
import { expectToFit, LONG_URL } from "test/layout";
import { paragraph } from "test/rich-text-fixtures";
import { editorOf, focusEditor } from "test/slate";

import PublicationMerge from "./PublicationMerge";

const DOM_CASMURRO: Publication = {
  ...empty(),
  id: 7,
  title: "Dom Casmurro",
  authors: ["Helen Caldwell"],
  originalTitle: "Dom Casmurro",
  originalAuthors: ["Machado de Assis"],
  year: "1953",
  countries: ["US"],
  publishers: ["Noonday Press"],
  sources: ["Caldwell, Helen. Introduction, 1953."],
};

// Two records of the same book, entered separately, as a search finds them,
// without notes: one adds a country and a publisher, the other adds only a
// source.
const DUPLICATES: Publication[] = [
  {
    ...DOM_CASMURRO,
    id: 8,
    countries: ["GB"],
    publishers: ["W. H. Allen"],
    sources: ["Gledson, John. Deceptive Realism, 1984."],
  },
  {
    ...DOM_CASMURRO,
    id: 9,
    sources: ["Caldwell, Helen. Introduction, 1953."],
  },
];

// The notes the first duplicate and the second are read with, in the stories
// where they have notes.
const BRITISH_NOTES: RichTextValue = [
  paragraph(
    "Bought from the publisher's ",
    { text: "remaindered", italic: true },
    " stock.",
  ),
];
const SECOND_NOTES: RichTextValue = [paragraph("Stamped by the bookseller.")];

/**
 * Returns a read of the duplicates in full that gives each the notes `notes`
 * holds under its id, and null notes when `notes` holds none.
 */
const readWith =
  (notes: Partial<Record<number, RichTextValue>>) =>
  async (id: number): Promise<Publication> => ({
    ...DUPLICATES.find((duplicate) => duplicate.id === id)!,
    notes: notes[id] ?? null,
  });

/**
 * Returns a story's `beforeEach` that replaces the API client's `post` with a
 * stub, and puts the real `post` back when the story ends. The stub resolves
 * with a response whose body is `answer`, or rejects with `answer` when it is
 * an error.
 */
const stubPost = (answer: unknown) => () => {
  const post = spyOn(http, "post").mockImplementation(async () => {
    if (answer instanceof Error) throw answer;
    return { data: answer } as never;
  });

  return () => post.mockRestore();
};

const meta = {
  title: "Publications/Publication merge",
  component: PublicationMerge,
  parameters: {
    layout: "fullscreen",
    docs: { story: { inline: false, height: "40rem" } },
  },
  args: {
    publication: DOM_CASMURRO,
    isOpen: true,
    onClose: fn(),
    onMerged: fn(),
    // Stories stand in for the database: the picker finds the duplicates by
    // title, and reading a duplicate in full returns it without notes.
    find: async (term: string) =>
      DUPLICATES.filter((p) =>
        p.title.toLowerCase().includes(term.toLowerCase()),
      ),
    read: readWith({}),
  },
} satisfies Meta<typeof PublicationMerge>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Searches for "casmurro" and waits until both duplicates are offered. */
async function searchDuplicates() {
  await screen.findByRole("dialog", { name: "Merge publications" });

  await userEvent.type(
    screen.getByLabelText("Search for publications to merge"),
    "casmurro",
  );
  await waitFor(() =>
    expect(screen.getAllByRole("button", { name: "Add" })).toHaveLength(2),
  );
}

/** Picks the first record on offer. */
const addFirst = () =>
  userEvent.click(screen.getAllByRole("button", { name: "Add" })[0]);

/** Returns the Notes field of the Result, once it is shown. */
const notesField = () => screen.findByRole("textbox", { name: "Notes" });

/** Nothing picked yet: the dialog names what survives and refuses to merge. */
export const Default: Story = {
  play: async () => {
    const dialog = await screen.findByRole("dialog", {
      name: "Merge publications",
    });
    await expect(dialog).toHaveTextContent(
      /Dom Casmurro.*1953.*keeps its place/,
    );
    await expect(
      screen.getByRole("button", { name: "Merge publication" }),
    ).toBeDisabled();
  },
};

/** A search offers every other record it finds, never the survivor itself. */
export const Searching: Story = {
  play: async () => {
    await searchDuplicates();
  },
};

/**
 * A picked record shows what the survivor becomes: everything it gains is
 * marked. The play test checks the gains in the Result, and that Merge is
 * enabled once the record is read.
 */
export const Previewing: Story = {
  play: async () => {
    await searchDuplicates();
    await addFirst();

    // The country and publisher it brings are the gain; the survivor's own
    // stay. Asked of the result itself, since the records on offer now show
    // every field they hold and would answer to the same text.
    const result = within(
      await screen.findByRole("region", { name: "Result" }),
    );
    await expect(result.getByText("GB")).toBeVisible();
    await expect(result.getByText("W. H. Allen")).toBeVisible();
    await expect(
      result.getByText("Gledson, John. Deceptive Realism, 1984."),
    ).toBeVisible();

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Merge publication" }),
      ).toBeEnabled(),
    );
  },
};

/**
 * A record that holds nothing new still leaves the database, so the dialog says
 * the merge takes nothing rather than showing an empty result.
 */
export const NothingGained: Story = {
  play: async () => {
    await searchDuplicates();
    // The second duplicate repeats the survivor exactly.
    await userEvent.click(screen.getAllByRole("button", { name: "Add" })[1]);

    await expect(
      await screen.findByText(/already says everything the others do/),
    ).toBeVisible();
  },
};

/**
 * The notes of two picked records proposed in the Notes field, in the order
 * they were picked. The play test checks the proposal, then removes the first
 * record and checks that the notes are proposed again without its notes.
 */
export const NotesProposed: Story = {
  args: { read: readWith({ 8: BRITISH_NOTES, 9: SECOND_NOTES }) },
  play: async () => {
    await searchDuplicates();
    await addFirst();
    await addFirst();

    const field = await notesField();
    await waitFor(() =>
      expect(editorOf(field).children).toEqual([
        ...BRITISH_NOTES,
        ...SECOND_NOTES,
      ]),
    );
    await expect(field).toHaveAccessibleDescription(
      "These are the notes the merged publication keeps. You can edit them before merging.",
    );
    await expect(
      screen.getByRole("button", { name: "Merge 2 publications" }),
    ).toBeEnabled();

    await userEvent.click(screen.getAllByRole("button", { name: "Remove" })[0]);

    await waitFor(async () =>
      expect(editorOf(await notesField()).children).toEqual(SECOND_NOTES),
    );
  },
};

/**
 * Notes edited before the merge. The play test deletes the second record's
 * paragraph and adds a word to the first, then removes and picks again the
 * second record, and checks that the field keeps the edited notes. The merge
 * request sends them.
 */
export const EditingNotes: Story = {
  args: { read: readWith({ 8: BRITISH_NOTES, 9: SECOND_NOTES }) },
  beforeEach: stubPost(null),
  play: async ({ args }) => {
    const edited = [
      paragraph(
        "Bought from the publisher's ",
        { text: "remaindered", italic: true },
        " stock. Signed.",
      ),
    ];

    await searchDuplicates();
    await addFirst();
    await addFirst();

    const field = await notesField();
    await waitFor(() => expect(editorOf(field).children).toHaveLength(2));
    Transforms.select(editorOf(field), [1]);
    await focusEditor(field);
    await userEvent.keyboard("{Backspace}{Backspace} Signed.");
    await waitFor(() => expect(editorOf(field).children).toEqual(edited));

    await userEvent.click(screen.getAllByRole("button", { name: "Remove" })[1]);
    await addFirst();
    await waitFor(async () =>
      expect(editorOf(await notesField()).children).toEqual(edited),
    );

    const confirm = screen.getByRole("button", {
      name: "Merge 2 publications",
    });
    await waitFor(() => expect(confirm).toBeEnabled());
    await userEvent.click(confirm);

    await waitFor(() => expect(args.onMerged).toHaveBeenCalled());
    await expect(http.post).toHaveBeenCalledWith("publications/7/merge", {
      losers: [8, 9],
      notes: edited,
    });
  },
};

/**
 * Notes over 10,000 characters: the survivor's long notes and a picked
 * record's notes together. The error is under the field and Merge is
 * disabled. The play test deletes the picked record's paragraph, which brings
 * the notes under the limit, and checks that Merge is enabled.
 */
export const NotesTooLong: Story = {
  args: {
    publication: {
      ...DOM_CASMURRO,
      notes: [paragraph("A long note. ".repeat(769))],
    },
    read: readWith({ 8: SECOND_NOTES }),
  },
  play: async () => {
    await searchDuplicates();
    await addFirst();

    const field = await notesField();
    await waitFor(() => expect(field).toHaveAttribute("aria-invalid", "true"));
    await expect(field).toHaveAccessibleDescription(
      expect.stringContaining("This text is too long"),
    );
    await expect(editorOf(field).children[1]).toEqual(SECOND_NOTES[0]);
    await expect(
      screen.getByRole("button", { name: "Merge publication" }),
    ).toBeDisabled();

    Transforms.select(editorOf(field), [1]);
    await focusEditor(field);
    await userEvent.keyboard("{Backspace}");

    await waitFor(() => expect(field).toHaveAttribute("aria-invalid", "false"));
    await expect(
      screen.getByRole("button", { name: "Merge publication" }),
    ).toBeEnabled();
  },
};

/**
 * No record has notes, so the Result has no Notes field. The play test checks
 * that the merge request then sends no notes.
 */
export const WithoutNotes: Story = {
  beforeEach: stubPost(null),
  play: async ({ args }) => {
    await searchDuplicates();
    await addFirst();

    const confirm = screen.getByRole("button", { name: "Merge publication" });
    await waitFor(() => expect(confirm).toBeEnabled());
    await expect(screen.queryByRole("textbox", { name: "Notes" })).toBeNull();
    await userEvent.click(confirm);

    await waitFor(() => expect(args.onMerged).toHaveBeenCalled());
    await expect(http.post).toHaveBeenCalledWith("publications/7/merge", {
      losers: [8],
    });
  },
};

/**
 * A picked record that is still being read. Merge is disabled, and the Notes
 * field waits for the record's notes, although the survivor has notes.
 */
export const Reading: Story = {
  args: {
    publication: { ...DOM_CASMURRO, notes: SECOND_NOTES },
    read: () => new Promise<Publication>(() => {}),
  },
  play: async () => {
    await searchDuplicates();
    await addFirst();

    await expect(
      await screen.findByRole("region", { name: "Result" }),
    ).toBeVisible();
    await expect(screen.queryByRole("textbox", { name: "Notes" })).toBeNull();
    await expect(
      screen.getByRole("button", { name: "Merge publication" }),
    ).toBeDisabled();
  },
};

/**
 * A picked record that could not be read says so, and Merge is disabled. The
 * play test checks that removing the record removes the message.
 */
export const ReadFailed: Story = {
  args: { read: async () => Promise.reject(new Error("Network Error")) },
  play: async () => {
    await searchDuplicates();
    await addFirst();

    await expect(await screen.findByRole("alert")).toHaveTextContent(
      "This record could not be read. Remove it and add it again.",
    );
    await expect(
      screen.getByRole("button", { name: "Merge publication" }),
    ).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "Remove" }));
    await expect(screen.queryByRole("alert")).toBeNull();
  },
};

/**
 * Notes the server refuses. The refusal is under the field, and Merge is
 * disabled until the notes are edited. The play test types into the field and
 * checks that the error goes and Merge is enabled again.
 */
export const NotesRefused: Story = {
  args: { publication: { ...DOM_CASMURRO, notes: SECOND_NOTES } },
  beforeEach: stubPost(new ApiError(400, { errors: { notes: "malformed" } })),
  play: async ({ args }) => {
    await searchDuplicates();
    await addFirst();

    const field = await notesField();
    const confirm = screen.getByRole("button", { name: "Merge publication" });
    await waitFor(() => expect(confirm).toBeEnabled());
    await userEvent.click(confirm);

    await waitFor(() => expect(field).toHaveAttribute("aria-invalid", "true"));
    await expect(field).toHaveAccessibleDescription(
      expect.stringContaining("This text could not be read"),
    );
    await expect(confirm).toBeDisabled();
    await expect(args.onMerged).not.toHaveBeenCalled();

    await focusEditor(field);
    await userEvent.keyboard("Note: ");

    await waitFor(() => expect(field).toHaveAttribute("aria-invalid", "false"));
    await expect(confirm).toBeEnabled();
  },
};

/** Backing out abandons the picks; nothing is asked of the server. */
export const Cancelled: Story = {
  play: async ({ args }) => {
    await searchDuplicates();
    await addFirst();

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await expect(args.onClose).toHaveBeenCalled();
    await expect(args.onMerged).not.toHaveBeenCalled();
  },
};

/**
 * A record on offer with a source too long for its line, such as a web
 * address: the source wraps inside the record's details. The play test
 * searches for the record and checks that the source does not run past the
 * details' edge.
 */
export const LongSource: Story = {
  args: { find: async () => [{ ...DUPLICATES[0], sources: [LONG_URL] }] },
  play: async () => {
    await screen.findByRole("dialog", { name: "Merge publications" });
    await userEvent.type(
      screen.getByLabelText("Search for publications to merge"),
      "casmurro",
    );

    const sources = (await screen.findByText(LONG_URL)).closest("dd")!;

    await expectToFit(sources, sources.closest("dl")!);
  },
};
