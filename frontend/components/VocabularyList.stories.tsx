import type { Meta, StoryObj } from "@storybook/react";
import type { Kind, Name, rename } from "modules/vocabulary";
import { expect, fn, screen, userEvent, waitFor } from "storybook/test";

import VocabularyList from "./VocabularyList";

// Publishers as they are actually typed: one house under two spellings, one
// that nothing is on any more, and one that is nobody's near-neighbour.
const PUBLISHERS: Name[] = [
  { id: 1, name: "Alfred A. Knopf", publications: 21 },
  { id: 2, name: "Alfred A.Knopf", publications: 2 },
  { id: 3, name: "Noonday Press", publications: 3 },
  { id: 4, name: "Peter Owen", publications: 0 },
];

const AUTHORS: Name[] = [
  { id: 10, name: "Helen Caldwell", publications: 7 },
  { id: 11, name: "Isabel Burton", publications: 1 },
  { id: 12, name: "Machado de Assis", publications: 12 },
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
    await expect(
      await screen.findByLabelText("Name, currently Alfred A. Knopf"),
    ).toBeInTheDocument();
    await expect(screen.getByText("21 publications")).toBeInTheDocument();

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

/** Nothing matched what was typed, which is different from nothing existing. */
export const NothingMatches: Story = {
  play: async () => {
    await userEvent.type(await screen.findByLabelText("Find"), "Hogarth");

    await expect(
      await screen.findByText("No names match."),
    ).toBeInTheDocument();
  },
};
