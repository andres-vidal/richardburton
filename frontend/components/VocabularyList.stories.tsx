import type { Meta, StoryObj } from "@storybook/react";
import type { Kind, Name, rename } from "modules/vocabulary";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";

import VocabularyList from "./VocabularyList";

// Four publishers: two spellings of Alfred A. Knopf that resemble each other,
// Noonday Press, and Peter Owen, which has no publications.
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

/** Every publisher, each with its publication count. */
export const Default: Story = {
  play: async () => {
    const field = await screen.findByLabelText(
      "Name, currently Alfred A. Knopf",
    );

    // Searches only this row, because the count also appears on the other
    // Knopf row, in the button that offers this name.
    const row = within(field.closest("li") as HTMLElement);
    await expect(row.getByText("21 publications")).toBeInTheDocument();

    // A name with no publications shows "unused" instead of "0 publications".
    await expect(screen.getByText("unused")).toBeInTheDocument();
  },
};

/** Switching to translators and original authors lists that kind instead. */
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
 * Typing part of a name in the filter lists both spellings of Alfred A. Knopf
 * together.
 */
export const FindingSpellings: Story = {
  play: async () => {
    await userEvent.type(await screen.findByLabelText("Find"), "knopf");

    await waitFor(async () =>
      expect(await screen.findAllByRole("listitem")).toHaveLength(2),
    );
  },
};

/** Typing a new name and pressing Enter sends the rename. */
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

/** Escape puts the stored name back in the field and sends nothing. */
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
 * The server refuses a rename that would give two publications the same
 * identity, and the alert lists both publications.
 */
export const WhenTwoPublicationsWouldCollide: Story = {
  args: {
    write: fn<typeof rename>(async () => ({
      collides: [
        { id: 31, title: "Dom Casmurro", year: 1953 },
        { id: 32, title: "Dom Casmurro", year: 1953 },
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
 * A name that resembles another is marked and lists the names it resembles.
 * The toggle shows only the marked names.
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
 * Clicking a resembling name writes it into the field without renaming. The
 * person still has to commit the field, because a fold cannot be undone.
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

    // The field changed, but no rename was sent.
    await expect(args.write).not.toHaveBeenCalled();
  },
};

/**
 * A `write` that answers like the server does when the new name is taken:
 * `{ folds }` without `fold`, and `merged` with it.
 */
const asksFirst = () =>
  fn<typeof rename>(async (_kind, _id, _name, fold) =>
    fold ? { outcome: "merged" } : { folds: PUBLISHERS[0] },
  );

/**
 * Renaming onto a taken name opens a confirmation dialog before anything is
 * folded. A rename onto a free name does not ask, because renaming back undoes
 * it.
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

    // The dialog names both records, each with its publication count.
    await expect(dialog).toHaveTextContent("Alfred A.Knopf (2 publications)");
    await expect(dialog).toHaveTextContent("Alfred A. Knopf (21 publications)");
    await expect(dialog).toHaveTextContent("There is no undo for this.");

    // Only the first, unconfirmed request was sent.
    await expect(args.write).toHaveBeenCalledTimes(1);
  },
};

/** Cancelling leaves the name unchanged and resets the field to it. */
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

/** Confirming sends the rename again with `fold` set to true. */
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

/** When the filter matches no name, the list says so. */
export const NothingMatches: Story = {
  play: async () => {
    await userEvent.type(await screen.findByLabelText("Find"), "Hogarth");

    await expect(
      await screen.findByText("No names match."),
    ).toBeInTheDocument();
  },
};
