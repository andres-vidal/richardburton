import type { Meta, StoryObj } from "@storybook/react";
import { empty, type Publication } from "modules/publication/model";
import { expect, fn, screen, userEvent, waitFor } from "storybook/test";

import PublicationMerge from "./PublicationMerge";

const DOM_CASMURRO: Publication = {
  ...empty(),
  id: 7,
  title: "Dom Casmurro",
  authors: "Helen Caldwell",
  originalTitle: "Dom Casmurro",
  originalAuthors: "Machado de Assis",
  year: "1953",
  countries: "US",
  publishers: "Noonday Press",
  references: ["Caldwell, Helen. Introduction, 1953."],
};

// Two records of the same book, entered separately: one adds a country and a
// publisher, the other adds only a source.
const DUPLICATES: Publication[] = [
  {
    ...DOM_CASMURRO,
    id: 8,
    countries: "GB",
    publishers: "W. H. Allen",
    references: ["Gledson, John. Deceptive Realism, 1984."],
  },
  {
    ...DOM_CASMURRO,
    id: 9,
    references: ["Caldwell, Helen. Introduction, 1953."],
  },
];

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
    // Stories stand in for the database so the picker has something to offer;
    // the confirmed merge needs the real server and is covered by the E2E suite.
    find: async (term: string) =>
      DUPLICATES.filter((p) =>
        p.title.toLowerCase().includes(term.toLowerCase()),
      ),
  },
} satisfies Meta<typeof PublicationMerge>;

export default meta;

type Story = StoryObj<typeof meta>;

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

/** A search offers every other record it finds — never the survivor itself. */
export const Searching: Story = {
  play: async () => {
    await screen.findByRole("dialog", { name: "Merge publications" });

    await userEvent.type(
      screen.getByLabelText("Search for publications to merge"),
      "casmurro",
    );

    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: "Add" })).toHaveLength(2),
    );
  },
};

/**
 * Picking a record shows what the survivor becomes: everything it gains is
 * marked, so the outcome is visible before a merge that cannot be undone.
 */
export const Previewing: Story = {
  play: async () => {
    await screen.findByRole("dialog", { name: "Merge publications" });

    await userEvent.type(
      screen.getByLabelText("Search for publications to merge"),
      "casmurro",
    );
    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: "Add" }).length).toBe(2),
    );
    await userEvent.click(screen.getAllByRole("button", { name: "Add" })[0]);

    // The country and publisher it brings are the gain; the survivor's own stay.
    await expect(await screen.findByText("Result")).toBeVisible();
    await expect(screen.getByText("GB")).toBeVisible();
    await expect(screen.getByText("W. H. Allen")).toBeVisible();
    await expect(
      screen.getByText("Gledson, John. Deceptive Realism, 1984."),
    ).toBeVisible();

    await expect(
      screen.getByRole("button", { name: "Merge publication" }),
    ).toBeEnabled();
  },
};

/**
 * A record that holds nothing new still leaves the database, so the dialog says
 * the merge takes nothing rather than showing an empty result.
 */
export const NothingGained: Story = {
  play: async () => {
    await screen.findByRole("dialog", { name: "Merge publications" });

    await userEvent.type(
      screen.getByLabelText("Search for publications to merge"),
      "casmurro",
    );
    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: "Add" }).length).toBe(2),
    );
    // The second duplicate repeats the survivor exactly.
    await userEvent.click(screen.getAllByRole("button", { name: "Add" })[1]);

    await expect(
      await screen.findByText(/already says everything the others do/),
    ).toBeVisible();
  },
};

/** Backing out abandons the picks; nothing is asked of the server. */
export const Cancelled: Story = {
  play: async ({ args }) => {
    await screen.findByRole("dialog", { name: "Merge publications" });

    await userEvent.type(
      screen.getByLabelText("Search for publications to merge"),
      "casmurro",
    );
    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: "Add" }).length).toBe(2),
    );
    await userEvent.click(screen.getAllByRole("button", { name: "Add" })[0]);

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await expect(args.onClose).toHaveBeenCalled();
    await expect(args.onMerged).not.toHaveBeenCalled();
  },
};
