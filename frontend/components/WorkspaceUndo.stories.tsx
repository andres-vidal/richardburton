import type { Meta, StoryObj } from "@storybook/react";
import { store } from "modules/store";
import { empty } from "modules/publication/model";
import {
  createId,
  openWorkspace,
  overrideField,
  resetAll,
  setAll,
  visiblePublicationFamily,
} from "modules/publication/store";
import { expect, screen, userEvent, waitFor } from "storybook/test";
import * as Y from "yjs";

import { addRow } from "modules/publication/doc";

import WorkspaceUndo from "./WorkspaceUndo";

const ROW = createId();

/**
 * A workspace with a document behind it, which is what gives the control
 * anything to walk back. Storybook takes the document down again after each
 * story, so no two share an undo stack.
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
 * A workspace picked up where it was left offers nothing to walk back. The
 * rows were not typed in this sitting — they arrived from disk, the way they
 * would arrive from a collaborator — and undo is about what *you* changed.
 */
export const NothingToUndo: Story = {
  beforeEach: () => {
    resetAll(store);
    const doc = new Y.Doc();
    const close = openWorkspace(store, doc);

    // Rows that came from somewhere else, rather than from an edit made here.
    const stored = new Y.Doc();
    addRow(stored, ROW, { ...empty(), title: "Dom Casmuro" });
    Y.applyUpdate(doc, Y.encodeStateAsUpdate(stored));

    return close;
  },
  play: async () => {
    // The rows are there...
    await expect(store.get(visiblePublicationFamily(ROW)).title).toBe(
      "Dom Casmuro",
    );

    // ...and nothing about them is this person's to take back.
    await expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
  },
};

/** An edit can be walked back, and the row returns to what it said before. */
export const AfterAnEdit: Story = {
  beforeEach: () => {
    const close = inAWorkspace();
    overrideField(store, ROW, "title", "Dom Casmurro");

    return close;
  },
  play: async () => {
    await expect(store.get(visiblePublicationFamily(ROW)).title).toBe(
      "Dom Casmurro",
    );

    await userEvent.click(screen.getByRole("button", { name: "Undo" }));

    await waitFor(() =>
      expect(store.get(visiblePublicationFamily(ROW)).title).toBe(
        "Dom Casmuro",
      ),
    );
  },
};

/** What was walked back can be put back. */
export const AndBackAgain: Story = {
  beforeEach: () => {
    const close = inAWorkspace();
    overrideField(store, ROW, "title", "Dom Casmurro");

    return close;
  },
  play: async () => {
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));

    const redo = await screen.findByRole("button", { name: "Redo" });
    await userEvent.click(redo);

    await waitFor(() =>
      expect(store.get(visiblePublicationFamily(ROW)).title).toBe(
        "Dom Casmurro",
      ),
    );
  },
};
