import type { Meta, StoryObj } from "@storybook/react";
import { withChanges } from "modules/publication/history";
import type { PublicationHistoryEntry } from "modules/publication/model";
import { expect, screen, within } from "storybook/test";
import { expectToFit, LONG_EMAIL } from "test/layout";
import { link, paragraph } from "test/rich-text-fixtures";

import PublicationHistory from "./PublicationHistory";

const SNAPSHOT: PublicationHistoryEntry["snapshot"] = {
  title: "Dom Casmurro",
  authors: ["Helen Caldwell"],
  originalTitle: "Dom Casmurro",
  originalAuthors: ["Machado de Assis"],
  year: 1953,
  countries: ["US"],
  publishers: ["Noonday Press"],
  sources: [],
};

// The notes a curator first wrote on the record, and the notes of the
// duplicate merged into it, which the merge appends.
const FIRST = [paragraph("A ", { text: "first", bold: true }, " translation.")];
const DUPLICATE = [paragraph("From the duplicate.")];

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
      sources: ["Gledson, John. Deceptive Realism, 1984."],
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
      sources: ["Gledson, John. Deceptive Realism, 1984."],
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
      sources: ["Gledson, John. Deceptive Realism, 1984."],
    },
    // One source swapped for another: nothing else moved.
    diff: {
      fields: {},
      sources: {
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
      sources: ["Caldwell, Helen. Introduction, 1953."],
    },
    // Retitled, with the first source added in the same save.
    diff: {
      fields: {
        title: { from: "Dom Casmurro", to: "Dom Casmurro (revised)" },
      },
      sources: {
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
    await expect(screen.getByText("Restored")).toBeInTheDocument();
    await expect(
      screen.getAllByText("by curator@rb.test").length,
    ).toBeGreaterThan(0);

    // Updates state exactly what changed: scalars as old → new, sources
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
          sources: ["Caldwell, Helen. Introduction, 1953."],
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

/**
 * Returns a publication's log in which a rename changed the names, with
 * `nameChange` and the `others` the server sends for the rename's entry, and
 * `snapshot` as the publication after it.
 */
function renamedLog(
  nameChange: PublicationHistoryEntry["nameChange"],
  snapshot: PublicationHistoryEntry["snapshot"],
  others: PublicationHistoryEntry["others"] = [],
): PublicationHistoryEntry[] {
  return [
    {
      version: 2,
      undoable: false,
      action: "renamed",
      actor: "curator@rb.test",
      timestamp: "2026-10-13T10:00:00",
      snapshot,
      diff: null,
      nameChange,
      others,
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
}

/** The rename entry in the canvas. */
const renamedIn = (canvasElement: HTMLElement) =>
  canvasElement.querySelector('[data-action="renamed"]') as HTMLElement;

/**
 * A publisher renamed in names management, which changed this publication and
 * two others. The entry states the name change, says it was made in Names, and
 * links to the other publications. The play test checks the heading, the
 * links, and that no field diff or note repeats the change.
 */
export const Renamed: Story = {
  args: {
    entries: withChanges(
      renamedLog(
        { publishers: { from: ["Noonday Press"], to: ["Noonday"] } },
        { ...SNAPSHOT, publishers: ["Noonday"] },
        [
          {
            id: 4,
            ...SNAPSHOT,
            title: "Philosopher or Dog?",
            year: 1954,
            publishers: ["Noonday"],
          },
          {
            id: 3,
            ...SNAPSHOT,
            title: "Epitaph of a Small Winner",
            year: 1952,
            publishers: ["Noonday"],
          },
        ],
      ),
    ),
  },
  play: async ({ canvasElement }) => {
    const renamed = renamedIn(canvasElement);

    await expect(renamed).toHaveTextContent("Renamed");
    await expect(renamed).toHaveTextContent(
      "Publisher “Noonday Press” renamed “Noonday” in Names",
    );
    await expect(renamed).toHaveTextContent("Also in:");

    const links = within(renamed).getAllByRole("link");
    await expect(links.map((link) => link.textContent)).toEqual([
      "Epitaph of a Small Winner (1952)",
      "Philosopher or Dog? (1954)",
    ]);
    await expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/en/publications/3",
      "/en/publications/4",
    ]);

    await expect(renamed).not.toHaveTextContent("Publishers:");
    await expect(renamed).not.toHaveTextContent("A name was changed");
  },
};

/**
 * A translator renamed on this publication alone. The entry states the change
 * and lists no other publication. The play test checks both.
 */
export const RenamedAlone: Story = {
  args: {
    entries: withChanges(
      renamedLog(
        { authors: { from: ["Helen Caldwel"], to: ["Helen Caldwell"] } },
        SNAPSHOT,
      ),
    ),
  },
  play: async ({ canvasElement }) => {
    const renamed = renamedIn(canvasElement);

    await expect(renamed).toHaveTextContent(
      "Translator “Helen Caldwel” renamed “Helen Caldwell” in Names",
    );
    await expect(renamed).not.toHaveTextContent("Also in");
    await expect(within(renamed).queryAllByRole("link")).toHaveLength(0);
  },
};

/**
 * A person who translated a book of their own, renamed in both roles. The
 * entry calls it a name. The play test checks the heading.
 */
export const RenamedInSeveralRoles: Story = {
  args: {
    entries: withChanges(
      renamedLog(
        {
          authors: { from: ["Ana Lessa"], to: ["Ana Lessa Bastos"] },
          originalAuthors: { from: ["Ana Lessa"], to: ["Ana Lessa Bastos"] },
        },
        {
          ...SNAPSHOT,
          authors: ["Ana Lessa Bastos"],
          originalAuthors: ["Ana Lessa Bastos"],
        },
      ),
    ),
  },
  play: async ({ canvasElement }) => {
    await expect(renamedIn(canvasElement)).toHaveTextContent(
      "Name “Ana Lessa” renamed “Ana Lessa Bastos” in Names",
    );
  },
};

/**
 * A publisher folded into another name that this publication already credits,
 * so the rename added no name to it. The entry says the name was folded. The
 * play test checks the heading.
 */
export const FoldedIntoACreditedName: Story = {
  args: {
    entries: withChanges(
      renamedLog(
        { publishers: { from: ["Penguin books"], to: [] } },
        { ...SNAPSHOT, publishers: ["Penguin Books"] },
      ),
    ),
  },
  play: async ({ canvasElement }) => {
    await expect(renamedIn(canvasElement)).toHaveTextContent(
      "Publisher “Penguin books” folded in Names into a name already credited",
    );
  },
};

/**
 * A rename whose entry has no name change, because the log holds nothing
 * earlier to compare it with. The entry says only that a name was changed in
 * Names. The play test checks the note.
 */
export const RenamedWithoutANameChange: Story = {
  args: {
    entries: withChanges([
      {
        version: 1,
        undoable: false,
        action: "renamed",
        actor: "curator@rb.test",
        timestamp: "2026-10-13T10:00:00",
        snapshot: { ...SNAPSHOT, publishers: ["Noonday"] },
        diff: null,
        nameChange: null,
      },
    ]),
  },
  play: async ({ canvasElement }) => {
    await expect(renamedIn(canvasElement)).toHaveTextContent(
      "A name was changed in Names, for every publication that credits it.",
    );
  },
};

/**
 * A duplicate reviewer's decisions: the publication was ruled not to be a
 * duplicate of another, and later put back in the review. Each entry names the
 * other publication by title, year and translators, and offers no undo. The
 * play test checks both entries.
 */
export const Decisions: Story = {
  args: {
    entries: withChanges([
      {
        version: 3,
        undoable: false,
        action: "reconsidered",
        actor: "curator@rb.test",
        timestamp: "2026-10-14T10:00:00",
        snapshot: SNAPSHOT,
        diff: null,
        others: [{ id: 7, ...SNAPSHOT, title: "Dom Casmuro", year: 1954 }],
      },
      {
        version: 2,
        undoable: false,
        action: "distinguished",
        actor: "curator@rb.test",
        timestamp: "2026-10-13T10:00:00",
        snapshot: SNAPSHOT,
        diff: null,
        others: [{ id: 7, ...SNAPSHOT, title: "Dom Casmuro", year: 1954 }],
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
    ]),
  },
  play: async ({ canvasElement }) => {
    const distinct = canvasElement.querySelector(
      '[data-action="distinguished"]',
    ) as HTMLElement;
    const reopened = canvasElement.querySelector(
      '[data-action="reconsidered"]',
    ) as HTMLElement;

    await expect(distinct).toHaveTextContent("Distinct");
    await expect(distinct).toHaveTextContent(
      "Not a duplicate ofDom Casmuro (1954) · Helen Caldwell",
    );
    await expect(reopened).toHaveTextContent("Reopened");
    await expect(reopened).toHaveTextContent(
      "Back in the duplicate review withDom Casmuro (1954)",
    );
  },
};

/**
 * Updates to the notes: the notes before and after each change, formatted,
 * with "(none)" where there were none. A merge lists the
 * notes of the record it took in. The play test checks the formatting
 * survives into the log.
 */
export const Notes: Story = {
  args: {
    entries: withChanges([
      {
        version: 4,
        undoable: true,
        action: "merged",
        actor: "curator@rb.test",
        timestamp: "2026-10-14T12:00:00",
        snapshot: SNAPSHOT,
        diff: {
          fields: {
            notes: { from: FIRST, to: [...FIRST, ...DUPLICATE] },
          },
          sources: null,
        },
        others: [
          {
            id: 7,
            ...SNAPSHOT,
            title: "Dom Casmuro",
            notes: DUPLICATE,
          },
        ],
      },
      {
        version: 3,
        undoable: false,
        action: "updated",
        actor: "curator@rb.test",
        timestamp: "2026-10-13T12:00:00",
        snapshot: SNAPSHOT,
        diff: {
          fields: { notes: { from: null, to: FIRST } },
          sources: null,
        },
      },
      {
        version: 2,
        undoable: false,
        action: "updated",
        actor: "curator@rb.test",
        timestamp: "2026-10-12T12:00:00",
        snapshot: SNAPSHOT,
        diff: {
          fields: {
            notes: {
              from: [
                paragraph(
                  "See ",
                  link("https://archive.org/details/x", "the scan"),
                  ".",
                ),
              ],
              to: null,
            },
          },
          sources: null,
        },
      },
    ]),
  },
  play: async ({ canvasElement }) => {
    const [merged, added, removed] = [
      ...canvasElement.querySelectorAll("li[data-action]"),
    ] as HTMLElement[];

    await expect(added).toHaveTextContent("Notes:−(none)+A first translation.");
    await expect(added.querySelector("ins strong")).toHaveTextContent("first");
    await expect(removed.querySelector("del a")).toHaveAttribute(
      "href",
      "https://archive.org/details/x",
    );
    await expect(merged).toHaveTextContent("Notes:From the duplicate.");
  },
};

/**
 * At a phone's width, an actor's address too long for its entry wraps inside
 * the entry. The play test checks that the address does not run past the
 * entry's edge.
 */
export const LongActor: Story = {
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
  args: {
    entries: withChanges([
      {
        version: 1,
        undoable: false,
        action: "deleted",
        actor: LONG_EMAIL,
        timestamp: "2026-07-20T09:00:00",
        snapshot: SNAPSHOT,
        diff: null,
      },
    ]),
  },
  play: async () => {
    const actor = screen.getByText(`by ${LONG_EMAIL}`);

    await expectToFit(actor, actor.closest("li")!);
  },
};
