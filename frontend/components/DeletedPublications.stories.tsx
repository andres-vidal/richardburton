import type { Meta, StoryObj } from "@storybook/react";
import { Publication } from "modules/publication/model";
import type { DeletedPublicationEntry } from "modules/publication/model";
import { expect, fn, screen, userEvent } from "storybook/test";

import DeletedPublications from "./DeletedPublications";

const ENTRIES: DeletedPublicationEntry[] = [
  {
    publication: {
      ...Publication.empty(),
      id: 1,
      title: "Dom Casmurro",
      authors: "Helen Caldwell",
      year: "1953",
      publishers: "Noonday Press",
    },
    deletedAt: "2026-07-20T09:00:00",
  },
  {
    publication: {
      ...Publication.empty(),
      id: 2,
      title: "Iraçéma the Honey-Lips",
      authors: "Isabel Burton",
      year: "1886",
      publishers: "Bickers & Son",
    },
    deletedAt: "2026-07-24T16:00:00",
  },
];

const meta = {
  title: "Publications/Deleted publications",
  component: DeletedPublications,
  args: { entries: ENTRIES, onRestore: fn() },
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
    onRestore: fn(() => new Promise<void>(() => {})),
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

/** An empty trash says so. */
export const Empty: Story = {
  args: { entries: [] },
  play: async () => {
    await expect(
      screen.getByText(/no publication is currently deleted/),
    ).toBeInTheDocument();
  },
};
