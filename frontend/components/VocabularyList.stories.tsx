import type { Meta, StoryObj } from "@storybook/react";
import type { Kind, Name, rename } from "modules/vocabulary";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";

import VocabularyList from "./VocabularyList";

// Publishers as they are actually typed: one house under two spellings, which
// point at each other, one that nothing is on any more, and one that the rest
// of the list is nothing like.
const PUBLISHERS: Name[] = [
  { id: 1, name: "Alfred A. Knopf", publications: 21, resembles: [2] },
  { id: 2, name: "Alfred A.Knopf", publications: 2, resembles: [1] },
  { id: 3, name: "Noonday Press", publications: 3, resembles: [] },
  { id: 4, name: "Peter Owen", publications: 0, resembles: [] },
];

const AUTHORS: Name[] = [
  { id: 10, name: "Helen Caldwell", publications: 7, resembles: [] },
  { id: 11, name: "Isabel Burton", publications: 1, resembles: [] },
  { id: 12, name: "Machado de Assis", publications: 12, resembles: [] },
];

const read = async (kind: Kind) => (kind === "authors" ? AUTHORS : PUBLISHERS);

const meta = {
  title: "Admin/Names",
  component: VocabularyList,
  args: {
    read,
    write: fn<typeof rename>(async () => ({ outcome: "renamed" })),
  },
} satisfies Meta<typeof VocabularyList>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Every publisher, each saying how much of the database rests on it. */
export const Default: Story = {
  play: async () => {
    const field = await screen.findByLabelText(
      "Name, currently Alfred A. Knopf",
    );

    // Scoped to the row: the count also appears on the row that offers this
    // name as a correction.
    const row = within(field.closest("li") as HTMLElement);
    await expect(row.getByText("21 publications")).toBeInTheDocument();

    // A name nothing is on reads as "unused" rather than "0 publications".
    await expect(screen.getByText("unused")).toBeInTheDocument();
  },
};

/** The other kind, behind the same one verb. */
export const Authors: Story = {
  play: async () => {
    await userEvent.click(
      await screen.findByRole("button", { name: "Translators & authors" }),
    );

    await expect(
      await screen.findByLabelText("Name, currently Machado de Assis"),
    ).toBeInTheDocument();
    await expect(
      screen.queryByLabelText("Name, currently Noonday Press"),
    ).toBeNull();
  },
};

/**
 * Filtering is how two spellings of one house are brought together, since the
 * list is sorted by name and a typo can sort far from what it meant.
 */
export const FindingSpellings: Story = {
  play: async () => {
    await userEvent.type(await screen.findByLabelText("Find"), "knopf");

    await waitFor(async () =>
      expect(await screen.findAllByRole("listitem")).toHaveLength(2),
    );
  },
};

/** Writing a name over another is the whole gesture — there is nothing to press. */
export const RenamingCommitsOnEnter: Story = {
  play: async ({ args }) => {
    const field = await screen.findByLabelText(
      "Name, currently Alfred A.Knopf",
    );

    await userEvent.clear(field);
    await userEvent.type(field, "Alfred A. Knopf{Enter}");

    await waitFor(() =>
      expect(args.write).toHaveBeenCalledWith(
        "publishers",
        2,
        "Alfred A. Knopf",
        false,
      ),
    );
  },
};

/** Escape puts the name back, so a half-typed correction costs nothing. */
export const EscapeReverts: Story = {
  play: async ({ args }) => {
    const field = await screen.findByLabelText("Name, currently Noonday Press");

    await userEvent.clear(field);
    await userEvent.type(field, "Noon{Escape}");

    await expect(field).toHaveValue("Noonday Press");
    await expect(args.write).not.toHaveBeenCalled();
  },
};

/**
 * The refusal, when correcting the spelling would leave two publications
 * holding one identity. It names them, because which ones they are is the
 * whole of what has to be decided next.
 */
export const WhenTwoPublicationsWouldCollide: Story = {
  args: {
    write: fn<typeof rename>(async () => ({
      collides: [
        { id: 31, title: "Dom Casmurro", year: "1953" },
        { id: 32, title: "Dom Casmurro", year: "1953" },
      ],
    })),
  },
  play: async () => {
    const field = await screen.findByLabelText(
      "Name, currently Alfred A.Knopf",
    );

    await userEvent.clear(field);
    await userEvent.type(field, "Alfred A. Knopf{Enter}");

    const alert = await screen.findByRole("alert");
    await expect(alert).toHaveTextContent(
      "That would leave two publications identical",
    );
    await expect(alert).toHaveTextContent("Dom Casmurro (1953)");
  },
};

/**
 * A name the rest of the list is close to is marked, and carries the others so
 * the spellings can be compared without hunting for them.
 */
export const NamesThatMayBeDuplicates: Story = {
  play: async () => {
    const doubtful = await screen.findByRole("button", {
      name: "2 names may be duplicates",
    });

    await userEvent.click(doubtful);

    await waitFor(async () =>
      expect(await screen.findAllByRole("listitem")).toHaveLength(2),
    );

    await expect(
      screen.getByRole("button", { name: "Alfred A.Knopf 2 publications" }),
    ).toBeVisible();
  },
};

/**
 * Taking the other spelling writes it into the field rather than renaming there
 * and then: a fold cannot be undone, so the last press stays the person's.
 */
export const OfferingTheOtherSpelling: Story = {
  play: async ({ args }) => {
    await userEvent.click(
      await screen.findByRole("button", {
        name: "Alfred A. Knopf 21 publications",
      }),
    );

    await expect(
      screen.getByLabelText("Name, currently Alfred A.Knopf"),
    ).toHaveValue("Alfred A. Knopf");

    // Written, not sent.
    await expect(args.write).not.toHaveBeenCalled();
  },
};

/** The server answering the way it does when the name is already taken. */
const asksFirst = () =>
  fn<typeof rename>(async (_kind, _id, _name, fold) =>
    fold ? { outcome: "merged" } : { folds: PUBLISHERS[0] },
  );

/**
 * Writing a name another holds is a fold, and a fold is asked about before it
 * happens. Correcting a spelling onto a free name still needs no permission —
 * that one is undone by renaming back.
 */
export const AskingBeforeFolding: Story = {
  args: { write: asksFirst() },
  play: async ({ args }) => {
    const field = await screen.findByLabelText(
      "Name, currently Alfred A.Knopf",
    );

    await userEvent.clear(field);
    await userEvent.type(field, "Alfred A. Knopf{Enter}");

    const dialog = await screen.findByRole("dialog", {
      name: "Fold these two together?",
    });

    // Says what goes, what it joins, and what each is carrying.
    await expect(dialog).toHaveTextContent("Alfred A.Knopf (2 publications)");
    await expect(dialog).toHaveTextContent("Alfred A. Knopf (21 publications)");
    await expect(dialog).toHaveTextContent("There is no undo for this.");

    // Asked, not done.
    await expect(args.write).toHaveBeenCalledTimes(1);
  },
};

/** Backing out leaves the name as it was, and the field showing it. */
export const BackingOutOfAFold: Story = {
  args: { write: asksFirst() },
  play: async ({ args }) => {
    const field = await screen.findByLabelText(
      "Name, currently Alfred A.Knopf",
    );

    await userEvent.clear(field);
    await userEvent.type(field, "Alfred A. Knopf{Enter}");

    const dialog = await screen.findByRole("dialog", {
      name: "Fold these two together?",
    });

    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cancel" }),
    );

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await expect(field).toHaveValue("Alfred A.Knopf");
    await expect(args.write).toHaveBeenCalledTimes(1);
  },
};

/** Confirming asks again, this time saying the fold is what was wanted. */
export const ConfirmingTheFold: Story = {
  args: { write: asksFirst() },
  play: async ({ args }) => {
    const field = await screen.findByLabelText(
      "Name, currently Alfred A.Knopf",
    );

    await userEvent.clear(field);
    await userEvent.type(field, "Alfred A. Knopf{Enter}");

    const dialog = await screen.findByRole("dialog", {
      name: "Fold these two together?",
    });

    await userEvent.click(
      within(dialog).getByRole("button", { name: "Fold them" }),
    );

    await waitFor(() =>
      expect(args.write).toHaveBeenLastCalledWith(
        "publishers",
        2,
        "Alfred A. Knopf",
        true,
      ),
    );
  },
};

/** Nothing matched what was typed, which is different from nothing existing. */
export const NothingMatches: Story = {
  play: async () => {
    await userEvent.type(await screen.findByLabelText("Find"), "Hogarth");

    await expect(
      await screen.findByText("No names match."),
    ).toBeInTheDocument();
  },
};
