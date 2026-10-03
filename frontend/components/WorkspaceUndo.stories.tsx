import type { Meta, StoryObj } from "@storybook/react";
import { store } from "modules/store";
import { empty } from "modules/publication/model";
import {
  createId,
  openWorkspace,
  setDiscarded,
  setField,
  resetAll,
  setAll,
  publicationFamily,
  visibleIdsAtom,
} from "modules/publication/store";
import { expect, screen, userEvent, waitFor } from "storybook/test";
import * as Y from "yjs";

import { addRow } from "modules/publication/doc";

import WorkspaceUndo from "./WorkspaceUndo";

const ROW = createId();

/**
 * Opens the store on a new Yjs document and adds one row. The control uses that
 * document's undo manager. Returns a cleanup that closes the document, so no
 * two stories share an undo stack.
 */
const inAWorkspace = () => {
  resetAll(store);
  const close = openWorkspace(store, new Y.Doc());

  setAll(store, [
    {
      id: ROW,
      errors: null,
      publication: { ...empty(), title: "Dom Casmuro" },
    },
  ]);

  return close;
};

const meta = {
  title: "Publications/Workspace undo",
  component: WorkspaceUndo,
  beforeEach: inAWorkspace,
  decorators: [
    (Story) => (
      <div className="flex p-8 bg-white">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof WorkspaceUndo>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * A reopened workspace has nothing to undo. Its rows are applied as an update
 * from another document, the way rows arrive from disk or from other people,
 * so they do not have the `LOCAL` origin that undo tracks.
 */
export const NothingToUndo: Story = {
  beforeEach: () => {
    resetAll(store);
    const doc = new Y.Doc();
    const close = openWorkspace(store, doc);

    // Builds the row in a separate document and applies it as an update.
    const stored = new Y.Doc();
    addRow(stored, ROW, { ...empty(), title: "Dom Casmuro" });
    Y.applyUpdate(doc, Y.encodeStateAsUpdate(stored));

    return close;
  },
  play: async () => {
    // The rows are there...
    await expect(store.get(publicationFamily(ROW)).title).toBe("Dom Casmuro");

    // ...but there is nothing to undo.
    await expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
  },
};

/** Undo reverts an edit, and the row gets its previous value back. */
export const AfterAnEdit: Story = {
  beforeEach: () => {
    const close = inAWorkspace();
    setField(store, ROW, "title", "Dom Casmurro");

    return close;
  },
  play: async () => {
    await expect(store.get(publicationFamily(ROW)).title).toBe("Dom Casmurro");

    await userEvent.click(screen.getByRole("button", { name: "Undo" }));

    await waitFor(() =>
      expect(store.get(publicationFamily(ROW)).title).toBe("Dom Casmuro"),
    );
  },
};

/** Undo brings back a row that was discarded, as its own step. */
export const AfterADiscard: Story = {
  beforeEach: () => {
    const close = inAWorkspace();
    setDiscarded(store, [ROW]);

    return close;
  },
  play: async () => {
    await expect(store.get(visibleIdsAtom)).toEqual([]);

    await userEvent.click(screen.getByRole("button", { name: "Undo" }));

    await waitFor(() => expect(store.get(visibleIdsAtom)).toEqual([ROW]));
  },
};

/** Redo reapplies an edit that was undone. */
export const AndBackAgain: Story = {
  beforeEach: () => {
    const close = inAWorkspace();
    setField(store, ROW, "title", "Dom Casmurro");

    return close;
  },
  play: async () => {
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));

    const redo = await screen.findByRole("button", { name: "Redo" });
    await userEvent.click(redo);

    await waitFor(() =>
      expect(store.get(publicationFamily(ROW)).title).toBe("Dom Casmurro"),
    );
  },
};
