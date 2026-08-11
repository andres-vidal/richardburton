import type { Meta, StoryObj } from "@storybook/react";
import { withChanges } from "modules/publication/history";
import type { PublicationHistoryEntry } from "modules/publication/model";
import { expect, screen } from "storybook/test";

import PublicationHistory from "./PublicationHistory";

const SNAPSHOT: PublicationHistoryEntry["snapshot"] = {
  title: "Dom Casmurro",
  authors: ["Helen Caldwell"],
  originalTitle: "Dom Casmurro",
  originalAuthors: ["Machado de Assis"],
  year: 1953,
  countries: ["US"],
  publishers: ["Noonday Press"],
  references: [],
};

// A full lifecycle — imported, retitled (with a source added), the source
// replaced by a better one, deleted by mistake, brought back — listed the way
// the API sends it: newest version first, so version numbers count down. Each
// update carries the structural diff the server computes; the stories run it
// through `withChanges`, the same decorator the remote layer uses, so what
// renders here is what renders in the app.
const LIFECYCLE: PublicationHistoryEntry[] = [
  {
    version: 5,
    undoable: true,
    action: "restored",
    actor: "curator@rb.test",
    timestamp: "2026-07-24T16:00:00",
    snapshot: {
      ...SNAPSHOT,
      title: "Dom Casmurro (revised)",
      references: ["Gledson, John. Deceptive Realism, 1984."],
    },
    diff: null,
  },
  {
    version: 4,
    undoable: false,
    action: "deleted",
    actor: "admin@rb.test",
    timestamp: "2026-07-20T09:00:00",
    snapshot: {
      ...SNAPSHOT,
      title: "Dom Casmurro (revised)",
      references: ["Gledson, John. Deceptive Realism, 1984."],
    },
    diff: null,
  },
  {
    version: 3,
    undoable: true,
    action: "updated",
    actor: "curator@rb.test",
    timestamp: "2026-07-15T11:00:00",
    snapshot: {
      ...SNAPSHOT,
      title: "Dom Casmurro (revised)",
      references: ["Gledson, John. Deceptive Realism, 1984."],
    },
    // One source swapped for another: nothing else moved.
    diff: {
      fields: {},
      references: {
        added: ["Gledson, John. Deceptive Realism, 1984."],
        removed: ["Caldwell, Helen. Introduction, 1953."],
        reordered: false,
      },
    },
  },
  {
    version: 2,
    undoable: false,
    action: "updated",
    actor: "admin@rb.test",
    timestamp: "2026-07-10T12:30:00",
    snapshot: {
      ...SNAPSHOT,
      title: "Dom Casmurro (revised)",
      references: ["Caldwell, Helen. Introduction, 1953."],
    },
    // Retitled, with the first source added in the same save.
    diff: {
      fields: {
        title: { from: "Dom Casmurro", to: "Dom Casmurro (revised)" },
      },
      references: {
        added: ["Caldwell, Helen. Introduction, 1953."],
        removed: [],
        reordered: false,
      },
    },
  },
  {
    version: 1,
    undoable: false,
    action: "created",
    actor: "importer@rb.test",
    timestamp: "2026-07-01T10:00:00",
    snapshot: SNAPSHOT,
    diff: null,
  },
];

const meta = {
  title: "Publications/Publication history",
  component: PublicationHistory,
  args: { entries: withChanges(LIFECYCLE) },
  // The component lives inside the publication modal's white dialog; the bare
  // canvas is gray, which would fail the contrast audit the real context passes.
  decorators: [
    (Story) => (
      <div className="p-4 bg-white">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PublicationHistory>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The full stream, newest first, with exact diffs on every update. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    // Newest first: restored leads, the import closes.
    const actions = [...canvasElement.querySelectorAll("[data-action]")].map(
      (node) => node.getAttribute("data-action"),
    );
    await expect(actions).toEqual([
      "restored",
      "deleted",
      "updated",
      "updated",
      "created",
    ]);

    // Every action is attributed.
    await expect(screen.getByText("restored")).toBeInTheDocument();
    await expect(
      screen.getAllByText("by curator@rb.test").length,
    ).toBeGreaterThan(0);

    // Updates state exactly what changed: scalars as old → new, references
    // as the precise entries added and removed.
    await expect(screen.getByText(/Title:/)).toHaveTextContent(
      "Title: Dom Casmurro → Dom Casmurro (revised)",
    );
    await expect(
      screen.getByText("+ Caldwell, Helen. Introduction, 1953."),
    ).toBeInTheDocument();
    await expect(
      screen.getByText("+ Gledson, John. Deceptive Realism, 1984."),
    ).toBeInTheDocument();
    // The removed entry renders struck through inside its − line.
    await expect(
      screen.getByText("Caldwell, Helen. Introduction, 1953.", {
        selector: "s",
      }),
    ).toBeInTheDocument();

    // Delete/restore change nothing field-wise — the only old → new line is
    // the title's.
    await expect(screen.getAllByText(/→/)).toHaveLength(1);
  },
};

/** Records created before the history log have no entries — say so. */
export const Empty: Story = {
  args: { entries: [] },
  play: async () => {
    await expect(
      screen.getByText(/predates the history log/),
    ).toBeInTheDocument();
  },
};

/**
 * A record whose log opens on an update — loaded into the database rather than
 * entered through the app, so its first change has no earlier version to be
 * compared against. The entry says that, rather than listing nothing.
 */
export const WithoutABaseline: Story = {
  args: {
    entries: withChanges([
      {
        version: 1,
        undoable: false,
        action: "updated",
        actor: "curator@rb.test",
        timestamp: "2026-07-15T11:00:00",
        snapshot: {
          ...SNAPSHOT,
          references: ["Caldwell, Helen. Introduction, 1953."],
        },
        diff: null,
      },
    ]),
  },
  play: async () => {
    await expect(
      screen.getByText(/Nothing earlier to compare with/),
    ).toBeInTheDocument();
  },
};
