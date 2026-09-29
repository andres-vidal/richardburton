import type { Meta, StoryObj } from "@storybook/react";
import { seed } from "modules/publication/fixtures";
import { store } from "modules/store";
import type { Kind, Resemblance } from "modules/vocabulary";
import { expect, fn, screen, userEvent, waitFor } from "storybook/test";

import WorkspaceNames from "./WorkspaceNames";

// Two rows that misspell one publisher and one translator. The other names are
// already in the database.
const BATCH = [
  {
    title: "Dom Casmurro",
    authors: ["Helen Caldwel"],
    originalAuthors: ["Machado de Assis"],
    publishers: ["Alfred A.Knopf"],
    year: "1953",
  },
  {
    title: "Esau and Jacob",
    authors: ["Helen Caldwel"],
    originalAuthors: ["Machado de Assis"],
    publishers: ["University of California Press"],
    year: "1965",
  },
];

const ANSWERS: Record<Kind, Resemblance[]> = {
  authors: [
    {
      name: "Helen Caldwel",
      held: false,
      resembles: [{ id: 1, name: "Helen Caldwell", publications: 6 }],
    },
    { name: "Machado de Assis", held: true, resembles: [] },
  ],
  publishers: [
    {
      name: "Alfred A.Knopf",
      held: false,
      resembles: [{ id: 2, name: "Alfred A. Knopf", publications: 21 }],
    },
    { name: "University of California Press", held: true, resembles: [] },
  ],
};

const settled = { authors: [], publishers: [] } as Record<Kind, Resemblance[]>;

const meta = {
  title: "Publications/Names in this batch",
  component: WorkspaceNames,
  args: {
    ask: fn(async (kind: Kind) => ANSWERS[kind]),
    // Stubbed because a corrected row is validated again, and Storybook has no
    // server.
    recheck: fn(async () => undefined),
  },
  beforeEach: () => seed(store, BATCH),
  parameters: { layout: "centered" },
} satisfies Meta<typeof WorkspaceNames>;

export default meta;

type Story = StoryObj<typeof meta>;

/** When any name may be misspelt, the footer button shows how many. */
export const SomethingMayBeMisspelt: Story = {
  play: async () => {
    await expect(
      await screen.findByRole("button", { name: "2 names may be misspelt" }),
    ).toBeVisible();
  },
};

/** When the database has every name, the button shows the name count. */
export const NothingDoubtful: Story = {
  args: { ask: fn(async (kind: Kind) => settled[kind]) },
  play: async () => {
    await expect(
      await screen.findByRole("button", { name: "4 names" }),
    ).toBeVisible();
  },
};

/** An empty batch renders no button. */
export const AnEmptyBatch: Story = {
  beforeEach: () => seed(store, []),
  play: async () => {
    await waitFor(() => expect(screen.queryByRole("button")).toBeNull());
  },
};

/**
 * The open dialog lists every name with its row count and its state. A name
 * that may be misspelt lists the stored names it resembles, each with its
 * publication count.
 */
export const TheWholeBatch: Story = {
  play: async () => {
    await userEvent.click(
      await screen.findByRole("button", { name: "2 names may be misspelt" }),
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Names in this batch",
    });

    await expect(dialog).toHaveTextContent("Helen Caldwel");
    await expect(dialog).toHaveTextContent("2 rows");
    await expect(dialog).toHaveTextContent("Alfred A. Knopf 21 publications");

    // A name the database already has is listed too.
    await expect(dialog).toHaveTextContent("Machado de Assis");
  },
};

/**
 * Clicking an offered spelling writes it into every row that had the
 * misspelling, in one step.
 */
export const TakingTheOfferedSpelling: Story = {
  play: async () => {
    await userEvent.click(
      await screen.findByRole("button", { name: "2 names may be misspelt" }),
    );

    await userEvent.click(
      await screen.findByRole("button", {
        name: "Helen Caldwell 6 publications",
      }),
    );

    // Both rows had the misspelling, and both now have the corrected spelling.
    await waitFor(async () =>
      expect(await screen.findByText("Helen Caldwell")).toBeVisible(),
    );
    await expect(screen.queryByText("Helen Caldwel")).toBeNull();
  },
};
