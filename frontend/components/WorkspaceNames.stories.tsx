import type { Meta, StoryObj } from "@storybook/react";
import { seed } from "modules/publication/fixtures";
import { store } from "modules/store";
import type { Kind, Resemblance } from "modules/vocabulary";
import { expect, fn, screen, userEvent, waitFor } from "storybook/test";

import WorkspaceNames from "./WorkspaceNames";

// A batch entered by someone working from a printed bibliography: one publisher
// and one translator spelt a second way, the rest already in the database.
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
      resembles: [
        { id: 1, name: "Helen Caldwell", publications: 6, resembles: [] },
      ],
    },
    { name: "Machado de Assis", held: true, resembles: [] },
  ],
  publishers: [
    {
      name: "Alfred A.Knopf",
      held: false,
      resembles: [
        { id: 2, name: "Alfred A. Knopf", publications: 21, resembles: [] },
      ],
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
    // There is no server here, and a corrected row would ask one to check it.
    recheck: fn(async () => undefined),
  },
  beforeEach: () => seed(store, BATCH),
  parameters: { layout: "centered" },
} satisfies Meta<typeof WorkspaceNames>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * The footer control, which says how much is doubtful rather than how much is
 * there — the count that needs looking at is the one worth reading at a glance.
 */
export const SomethingMayBeMisspelt: Story = {
  play: async () => {
    await expect(
      await screen.findByRole("button", { name: "2 names may be misspelt" }),
    ).toBeVisible();
  },
};

/** A batch whose every name the database already holds says only how many. */
export const NothingDoubtful: Story = {
  args: { ask: fn(async (kind: Kind) => settled[kind]) },
  play: async () => {
    await expect(
      await screen.findByRole("button", { name: "4 names" }),
    ).toBeVisible();
  },
};

/** Nothing entered yet is nothing to say, so the control is not there at all. */
export const AnEmptyBatch: Story = {
  beforeEach: () => seed(store, []),
  play: async () => {
    await waitFor(() => expect(screen.queryByRole("button")).toBeNull());
  },
};

/**
 * Opened: every name, what rests on it here, and where it stands against the
 * database. A doubtful name carries the spellings it might have meant, each
 * with how many publications already use it.
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

    // A name the database already holds is not flagged.
    await expect(dialog).toHaveTextContent("Machado de Assis");
  },
};

/**
 * Taking the offered spelling writes it into every row that carried the other
 * one, which is the whole point of collecting the batch's names in one place:
 * the correction is made once rather than row by row.
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

    // Both rows carried it, and both now read the corrected spelling.
    await waitFor(async () =>
      expect(await screen.findByText("Helen Caldwell")).toBeVisible(),
    );
    await expect(screen.queryByText("Helen Caldwel")).toBeNull();
  },
};
