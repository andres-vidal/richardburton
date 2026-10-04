import type { Meta, StoryObj } from "@storybook/react";
import { Publication } from "modules/publication/model";
import type { DeletedPublicationEntry } from "modules/publication/model";
import type { Restoration } from "modules/publication/remote";
import { expect, fn, screen, userEvent, within } from "storybook/test";

import DeletedPublications from "./DeletedPublications";

const ENTRIES: DeletedPublicationEntry[] = [
  {
    publication: {
      ...Publication.empty(),
      id: 1,
      title: "Dom Casmurro",
      authors: ["Helen Caldwell"],
      year: "1953",
      publishers: ["Noonday Press"],
    },
    deletedAt: "2026-07-20T09:00:00",
  },
  {
    publication: {
      ...Publication.empty(),
      id: 2,
      title: "Iraçéma the Honey-Lips",
      authors: ["Isabel Burton"],
      year: "1886",
      publishers: ["Bickers & Son"],
    },
    deletedAt: "2026-07-24T16:00:00",
  },
];

// The record imported again while the first "Dom Casmurro" was deleted.
const TWIN = {
  ...ENTRIES[0].publication,
  id: 3,
  originalTitle: "Dom Casmurro",
  originalAuthors: ["Machado de Assis"],
  countries: ["US"],
};

const meta = {
  title: "Publications/Deleted publications",
  component: DeletedPublications,
  args: {
    entries: ENTRIES,
    onRestore: fn(async (): Promise<Restoration> => ({ outcome: "restored" })),
  },
} satisfies Meta<typeof DeletedPublications>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Each tombstone shows what it was and when it left, with a one-click restore. */
export const Default: Story = {
  play: async ({ args }) => {
    await expect(screen.getByText("Dom Casmurro")).toBeInTheDocument();
    await expect(screen.getByText(/Deleted Jul 20, 2026/)).toBeInTheDocument();

    // Restore is non-destructive — a single click, no confirmation gate.
    const restores = screen.getAllByRole("button", { name: "Restore" });
    await expect(restores).toHaveLength(2);
    await userEvent.click(restores[0]);
    await expect(args.onRestore).toHaveBeenCalledWith(1);
  },
};

/**
 * While one restore is in flight only that row shows it, and a second row
 * cannot start one. The list owns this state, so it is reached by clicking
 * rather than by setting a prop.
 */
export const Restoring: Story = {
  args: {
    // Never resolves, so the in-flight window stays open for the assertions.
    onRestore: fn(() => new Promise<Restoration>(() => {})),
  },
  play: async ({ args }) => {
    const [first, second] = screen.getAllByRole("button", { name: "Restore" });
    await expect(second).toBeEnabled();

    await userEvent.click(first);

    await expect(first).toBeDisabled();
    await expect(second).toBeDisabled();
    await expect(args.onRestore).toHaveBeenCalledTimes(1);
  },
};

/**
 * A restore refused because another publication has the same identity opens a
 * dialog. It shows that publication, and the deleted one's edit form, which
 * starts with the conflict as its error, so it cannot be restored unchanged.
 */
export const WhenAnIdenticalOneExists: Story = {
  args: {
    onRestore: fn(async (): Promise<Restoration> => ({
      outcome: "identical",
      twin: TWIN,
    })),
  },
  play: async ({ args }) => {
    await userEvent.click(
      screen.getAllByRole("button", { name: "Restore" })[0],
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Another publication is identical to this one",
    });
    await expect(args.onRestore).toHaveBeenCalledWith(1);

    // The identical publication links to its own page.
    await expect(
      within(dialog).getByRole("link", { name: "Open this record" }),
    ).toHaveAttribute("href", expect.stringMatching(/\/publications\/3$/));

    // The deleted publication's fields can be changed, and it cannot be
    // restored as it is.
    await expect(
      within(dialog).getByRole("textbox", { name: "Year" }),
    ).toHaveValue("1953");
    await expect(
      within(dialog).getByRole("button", {
        name: "Restore with these changes",
      }),
    ).toBeDisabled();
  },
};

/** An empty trash says so. */
export const Empty: Story = {
  args: { entries: [] },
  play: async () => {
    await expect(
      screen.getByText(/no publication is currently deleted/),
    ).toBeInTheDocument();
  },
};
