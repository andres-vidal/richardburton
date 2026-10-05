import type { Meta, StoryObj } from "@storybook/react";
import type { Kind, Listed, Name, rename } from "modules/vocabulary";
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
 * identity. The alert links to both publications and to the duplicate review,
 * each in a new tab.
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

    const records = within(alert).getAllByRole("link", {
      name: "Dom Casmurro (1953)",
    });
    await expect(records.map((link) => link.getAttribute("href"))).toEqual([
      expect.stringMatching(/\/publications\/31$/),
      expect.stringMatching(/\/publications\/32$/),
    ]);

    const review = within(alert).getByRole("link", {
      name: "Open the duplicate review",
    });
    await expect(review.getAttribute("href")).toMatch(
      /\/admin\/publications\/duplicates$/,
    );
    await expect(
      [...records, review].map((link) => link.getAttribute("target")),
    ).toEqual(["_blank", "_blank", "_blank"]);
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

// The two publications that credit "Alfred A.Knopf".
const KNOPF_TYPO: Listed[] = [
  { id: 31, title: "Dona Flor and Her Two Husbands", year: 1969 },
  { id: 32, title: "Gabriela, Clove and Cinnamon", year: 1962 },
];

/**
 * A `write` that answers like the server does when the new name is taken:
 * `{ folds, publications }` without `fold`, and `merged` with it. The
 * publications are those that credit the renamed name, `KNOPF_TYPO` unless
 * given.
 */
const asksFirst = (publications: Listed[] = KNOPF_TYPO) =>
  fn<typeof rename>(async (_kind, _id, name, fold) =>
    fold
      ? { outcome: "merged" }
      : {
          folds: PUBLISHERS.find((other) => other.name === name)!,
          publications,
        },
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

    // The dialog names both records, and lists the publications that would be
    // credited to the other name, each linking to its page in a new tab.
    await expect(dialog).toHaveTextContent(
      "Alfred A.Knopf would stop existing. The 2 publications below would be credited to Alfred A. Knopf instead. There is no undo for this.",
    );

    const listed = within(dialog).getByRole("list", {
      name: "Publications credited to Alfred A.Knopf",
    });
    const links = within(listed).getAllByRole("link");

    await expect(links.map((link) => link.textContent)).toEqual([
      "Dona Flor and Her Two Husbands (1969)",
      "Gabriela, Clove and Cinnamon (1962)",
    ]);
    await expect(links[0]).toHaveAttribute(
      "href",
      expect.stringContaining("/publications/31"),
    );
    await expect(links[0]).toHaveAttribute("target", "_blank");

    // Only the first, unconfirmed request was sent.
    await expect(args.write).toHaveBeenCalledTimes(1);
  },
};

/**
 * Folding a name that no publication credits says so, and lists nothing.
 */
export const FoldingAnUnusedName: Story = {
  args: { write: asksFirst([]) },
  play: async () => {
    const field = await screen.findByLabelText("Name, currently Peter Owen");

    await userEvent.clear(field);
    await userEvent.type(field, "Noonday Press{Enter}");

    const dialog = await screen.findByRole("dialog", {
      name: "Fold these two together?",
    });

    await expect(dialog).toHaveTextContent(
      "Peter Owen would stop existing. No publication credits it.",
    );
    await expect(within(dialog).queryByRole("list")).toBeNull();
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
