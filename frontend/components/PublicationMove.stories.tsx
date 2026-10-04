import type { Meta, StoryObj } from "@storybook/react";
import type {
  DocumentPage,
  DocumentSummary,
} from "modules/publication/document-remote";
import { publicationIdsAtom } from "modules/publication/store";
import { clearSelection, getSelection, select } from "modules/selection";
import { store } from "modules/store";
import { seed } from "test/publication-fixtures";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";

import PublicationMove from "./PublicationMove";

const summary = (
  id: number,
  name: string,
  rows: number,
  updatedAt: string,
): DocumentSummary => ({
  id,
  name,
  rows,
  archivedAt: null,
  insertedAt: updatedAt,
  updatedAt,
});

// The workspace in these stories is document 1, so it is left out of the list.
const FIRST_PAGE: DocumentPage = {
  entries: [
    summary(1, "Second pass, 2026", 428, "2026-09-19T16:20:00"),
    summary(2, "Amado retranslations", 12, "2026-08-14T09:30:00"),
  ],
  more: true,
};

const OLDER: DocumentPage = {
  entries: [summary(7, "Machado, first sweep", 64, "2026-05-03T10:00:00")],
  more: false,
};

// Selects the first two rows of the workspace, as clicking their leading cells
// with Cmd held would.
function selectTwoRows() {
  const [first, second] = store.get(publicationIdsAtom) ?? [];

  select(store, { id: first, type: "publication" });
  select(store, { id: second, type: "publication", metaKey: true });
}

const meta = {
  title: "Publications/Publication move",
  component: PublicationMove,
  parameters: { layout: "centered" },
  args: {
    document: 1,
    readDocuments: fn(async ({ after }) => (after ? OLDER : FIRST_PAGE)),
    start: fn(async (name: string) =>
      summary(9, name, 0, "2026-10-04T10:00:00"),
    ),
    move: fn(async () => {}),
  },
  beforeEach: () => {
    seed(store);
    selectTwoRows();
  },
} satisfies Meta<typeof PublicationMove>;

export default meta;

type Story = StoryObj<typeof meta>;

async function openDialog(canvasElement: HTMLElement) {
  await userEvent.click(
    within(canvasElement).getByRole("button", { name: "Move 2" }),
  );

  return screen.findByRole("dialog", {
    name: "Move 2 rows to another document",
  });
}

/**
 * Moves the two selected rows into a new document named on the spot. The
 * document is started with that name, the rows are moved into it, and the
 * selection is cleared.
 */
export const ToANewDocument: Story = {
  play: async ({ args, canvasElement }) => {
    const dialog = await openDialog(canvasElement);
    const confirm = within(dialog).getByRole("button", { name: "Move 2 rows" });

    // A new document needs a name before anything can move.
    await expect(confirm).toBeDisabled();

    await userEvent.type(
      within(dialog).getByRole("textbox", { name: "Name of the new document" }),
      "Set aside",
    );
    await userEvent.click(confirm);

    await waitFor(() => expect(args.move).toHaveBeenCalledTimes(1));
    await expect(args.start).toHaveBeenCalledWith("Set aside");
    await expect((args.move as ReturnType<typeof fn>).mock.calls[0][2]).toBe(9);
    await waitFor(() => expect(getSelection(store).size).toBe(0));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  },
};

/**
 * Moves the selected rows into a document that exists. The list leaves out the
 * document the rows are in, and no document is started.
 */
export const ToAnExistingDocument: Story = {
  play: async ({ args, canvasElement }) => {
    const dialog = await openDialog(canvasElement);

    await expect(
      await within(dialog).findByRole("radio", {
        name: "Amado retranslations 12 rows",
      }),
    ).toBeVisible();
    await expect(within(dialog).queryByText("Second pass, 2026")).toBeNull();

    await userEvent.click(
      within(dialog).getByRole("radio", {
        name: "Amado retranslations 12 rows",
      }),
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Move 2 rows" }),
    );

    await waitFor(() => expect(args.move).toHaveBeenCalledTimes(1));
    await expect((args.move as ReturnType<typeof fn>).mock.calls[0][2]).toBe(2);
    await expect(args.start).not.toHaveBeenCalled();
  },
};

/**
 * **Show more** reads the next page of documents, starting after the last one
 * shown, and adds it to the list.
 */
export const ShowingOlderDocuments: Story = {
  play: async ({ args, canvasElement }) => {
    const dialog = await openDialog(canvasElement);

    await userEvent.click(
      await within(dialog).findByRole("button", { name: "Show more" }),
    );

    await expect(
      await within(dialog).findByRole("radio", {
        name: "Machado, first sweep 64 rows",
      }),
    ).toBeVisible();
    await expect(args.readDocuments).toHaveBeenLastCalledWith(
      expect.objectContaining({
        after: { id: 2, updatedAt: "2026-08-14T09:30:00" },
      }),
    );
  },
};

/**
 * The dialog moves the rows that were selected when it opened, even after the
 * selection is cleared, as a click anywhere that is not a row clears it in the
 * workspace. The **Move N** button goes with the selection, but the dialog
 * stays.
 */
export const AfterTheSelectionIsCleared: Story = {
  play: async ({ args, canvasElement }) => {
    const [first, second] = store.get(publicationIdsAtom) ?? [];
    const dialog = await openDialog(canvasElement);

    clearSelection(store);

    await waitFor(() =>
      expect(
        within(canvasElement).queryByRole("button", { name: /^Move/ }),
      ).toBeNull(),
    );
    await userEvent.type(
      within(dialog).getByRole("textbox", { name: "Name of the new document" }),
      "Set aside",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Move 2 rows" }),
    );

    await waitFor(() => expect(args.move).toHaveBeenCalledTimes(1));
    await expect((args.move as ReturnType<typeof fn>).mock.calls[0][1]).toEqual(
      [first, second],
    );
  },
};

/**
 * When the move fails, the dialog stays open on the same rows, so the person
 * can try again. A document started for the move is kept and chosen, so trying
 * again does not start a second one.
 */
export const WhenTheMoveFails: Story = {
  args: {
    move: fn(async () => {
      throw new Error("offline");
    }),
  },
  play: async ({ args, canvasElement }) => {
    const dialog = await openDialog(canvasElement);

    await userEvent.type(
      within(dialog).getByRole("textbox", { name: "Name of the new document" }),
      "Set aside",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Move 2 rows" }),
    );

    await waitFor(() => expect(args.move).toHaveBeenCalledTimes(1));
    await expect(dialog).toBeVisible();
    await expect(
      within(dialog).getByRole("button", { name: "Move 2 rows" }),
    ).toBeEnabled();
    await expect(
      await within(dialog).findByRole("radio", { name: "Set aside Empty" }),
    ).toBeChecked();
  },
};
