import type { Meta, StoryObj } from "@storybook/react";
import { withChanges } from "modules/publication/history";
import type { FullHistoryEntry } from "modules/publication/model";
import { expect, fn, screen, userEvent } from "storybook/test";

import PublicationHistoryFeed from "./PublicationHistoryFeed";

const DOM_CASMURRO: FullHistoryEntry["snapshot"] = {
  title: "Dom Casmurro",
  authors: "Helen Caldwell",
  originalTitle: "Dom Casmurro",
  originalAuthors: "Machado de Assis",
  year: 1953,
  countries: "US",
  publishers: "Noonday Press",
  sources: [],
};

const IRACEMA: FullHistoryEntry["snapshot"] = {
  title: "Iraçéma the Honey-Lips",
  authors: "Isabel Burton",
  originalTitle: "Iracema",
  originalAuthors: "José de Alencar",
  year: 1886,
  countries: "GB",
  publishers: "Bickers & Son",
  sources: [],
};

// Two records' streams interleaved, newest first — the way the server feeds
// it. Iracema was retitled (v2) and then re-dated (v3): the retitle's fields
// are untouched since, so it stays undoable even though it isn't the record's
// latest entry. Dom Casmurro was deleted (v2) and brought back (v3), which
// settles that delete — a restore has already negated it.
const FEED: FullHistoryEntry[] = [
  {
    publicationId: 1,
    version: 3,
    undoable: true,
    action: "restored",
    actor: "curator@rb.test",
    timestamp: "2026-07-24T14:00:00",
    snapshot: DOM_CASMURRO,
    diff: null,
  },
  {
    publicationId: 2,
    version: 3,
    undoable: true,
    action: "updated",
    actor: "curator@rb.test",
    timestamp: "2026-07-24T12:00:00",
    snapshot: { ...IRACEMA, title: "Iracema, a Legend of Brazil", year: 1954 },
    // Only the year: the retitle below is left untouched, which is what keeps
    // it undoable further down the feed.
    diff: { fields: { year: { from: 1886, to: 1954 } }, sources: null },
  },
  {
    publicationId: 1,
    version: 2,
    // Settled: the restore above already negated it.
    undoable: false,
    action: "deleted",
    actor: "admin@rb.test",
    timestamp: "2026-07-20T09:00:00",
    snapshot: DOM_CASMURRO,
    diff: null,
  },
  {
    publicationId: 2,
    version: 2,
    undoable: true,
    action: "updated",
    actor: "curator@rb.test",
    timestamp: "2026-07-15T11:00:00",
    snapshot: { ...IRACEMA, title: "Iracema, a Legend of Brazil" },
    diff: {
      fields: {
        title: {
          from: "Iraçéma the Honey-Lips",
          to: "Iracema, a Legend of Brazil",
        },
      },
      sources: null,
    },
  },
  {
    publicationId: 2,
    version: 1,
    undoable: false,
    action: "created",
    actor: "importer@rb.test",
    timestamp: "2026-07-10T10:00:00",
    snapshot: IRACEMA,
    diff: null,
  },
  {
    publicationId: 1,
    version: 1,
    undoable: false,
    action: "created",
    actor: "importer@rb.test",
    timestamp: "2026-07-01T10:00:00",
    snapshot: DOM_CASMURRO,
    diff: null,
  },
];

const meta = {
  title: "Publications/Publication history feed",
  component: PublicationHistoryFeed,
  args: { entries: withChanges(FEED), onUndo: fn() },
  // Matches the admin pages' canvas; the audit runs against a real background.
  decorators: [
    (Story) => (
      <div className="p-4 bg-white">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PublicationHistoryFeed>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Interleaved streams; undo wherever the action is still reconcilable. */
export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    // Newest first, across publications.
    const actions = [...canvasElement.querySelectorAll("[data-action]")].map(
      (node) => node.getAttribute("data-action"),
    );
    await expect(actions).toEqual([
      "restored",
      "updated",
      "deleted",
      "updated",
      "created",
      "created",
    ]);

    // The update diffs against ITS OWN previous version — the exact title
    // change — despite another record's entry between them in the feed.
    await expect(screen.getByText(/Title:/)).toHaveTextContent(
      "Title: Iraçéma the Honey-Lips → Iracema, a Legend of Brazil",
    );
    await expect(screen.getByText(/Year:/)).toHaveTextContent(
      "Year: 1886 → 1954",
    );

    // Undoable: the two heads AND the older retitle (its fields untouched
    // since) — but not the imports, whose undo would discard later work, and
    // not the delete a restore has already negated.
    const undos = screen.getAllByRole("button", { name: "Undo" });
    await expect(undos).toHaveLength(3);
    await userEvent.click(undos[2]);
    await expect(args.onUndo).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "updated",
        publicationId: 2,
        version: 2,
      }),
    );
  },
};

/**
 * One undo at a time, and visibly so: the pressed row spins while every other
 * undoable row goes disabled for the duration. A refused click should look
 * refused rather than do nothing.
 */
export const UndoInFlight: Story = {
  args: {
    // Never resolves, so the in-flight window stays open for the assertions.
    onUndo: fn(() => new Promise<boolean>(() => {})),
  },
  play: async ({ args }) => {
    const undos = screen.getAllByRole("button", { name: "Undo" });
    await expect(undos[1]).toBeEnabled();

    await userEvent.click(undos[0]);

    // The pressed row is busy, and its siblings are barred rather than silently
    // ignoring a press.
    await expect(undos[0]).toBeDisabled();
    await expect(undos[1]).toBeDisabled();
    await expect(args.onUndo).toHaveBeenCalledTimes(1);
  },
};

/**
 * The action chips narrow what is shown, never what diffs or undoability are
 * computed against — and they are view state, not navigation. (What is
 * *currently* deleted is its own page: a log of deletion events answers a
 * different question than the set of records presently in the trash.)
 */
export const FilteredByAction: Story = {
  play: async ({ canvasElement }) => {
    const actions = () =>
      [...canvasElement.querySelectorAll("[data-action]")].map((node) =>
        node.getAttribute("data-action"),
      );

    await userEvent.click(screen.getByRole("button", { name: "deleted" }));
    await expect(actions()).toEqual(["deleted"]);
    // Narrowing to it does not make it actionable: this delete was already
    // undone by the restore, so it carries no Undo however it is filtered.
    await expect(
      screen.queryAllByRole("button", { name: "Undo" }),
    ).toHaveLength(0);

    // The restore that settled it is its own entry, and is undoable.
    await userEvent.click(screen.getByRole("button", { name: "deleted" }));
    await userEvent.click(screen.getByRole("button", { name: "restored" }));
    await expect(actions()).toEqual(["restored"]);
    await expect(screen.getAllByRole("button", { name: "Undo" })).toHaveLength(
      1,
    );

    // Toggling the chip off widens back to the full feed.
    await userEvent.click(screen.getByRole("button", { name: "restored" }));
    await expect(actions()).toHaveLength(6);
  },
};

/** The text filter narrows by title or acting user. */
export const TextFilter: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.type(
      screen.getByRole("textbox", { name: "Filter by title or user" }),
      "importer",
    );
    const actions = [...canvasElement.querySelectorAll("[data-action]")].map(
      (node) => node.getAttribute("data-action"),
    );
    await expect(actions).toEqual(["created", "created"]);
  },
};

/** A fresh log states its emptiness. */
export const Empty: Story = {
  args: { entries: [] },
  play: async () => {
    await expect(
      screen.getByText("No changes recorded yet."),
    ).toBeInTheDocument();
  },
};
