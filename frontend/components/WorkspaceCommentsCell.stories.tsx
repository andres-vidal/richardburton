import type { Meta, StoryObj } from "@storybook/react";
import { store, type Store } from "modules/store";
import { Publication, type PublicationError } from "modules/publication/model";
import { publicationFamily, resetAll, setAll } from "modules/publication/store";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";

import WorkspaceCommentsCell from "./WorkspaceCommentsCell";

// A mock of the row's click handler, which selects the row in the workspace.
const selectRow = fn();

// Fills the store with one row, `rowId`, holding `comments` and `errors`.
const seed = (
  store: Store,
  rowId: number,
  comments: string | null,
  errors: PublicationError = null,
) => {
  resetAll(store);
  selectRow.mockClear();
  setAll(store, [
    {
      id: rowId,
      publication: { ...Publication.empty(), title: "Iracema", comments },
      errors,
    },
  ]);
};

const meta = {
  title: "Publications/Workspace comments cell",
  component: WorkspaceCommentsCell,
  args: { rowId: 1 },
  decorators: [
    (Story) => (
      <div role="table">
        <div role="row" onClick={selectRow}>
          <Story />
        </div>
      </div>
    ),
  ],
  parameters: {
    layout: "centered",
    // The open modal aria-hides the background trigger, which is still
    // focusable.
    a11y: { config: { rules: [{ id: "aria-hidden-focus", enabled: false }] } },
  },
} satisfies Meta<typeof WorkspaceCommentsCell>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * A row without comments: the button reads "Comments" and is named "Add
 * comments". Pressing it opens the editor in a dialog without selecting the
 * row.
 */
export const Empty: Story = {
  beforeEach: () => seed(store, 1, null),
  play: async () => {
    const button = screen.getByRole("button", { name: "Add comments" });
    await expect(button).toHaveTextContent("Comments");

    await userEvent.click(button);
    const dialog = await screen.findByRole("dialog", { name: "Edit comments" });
    await expect(
      within(dialog).getByRole("textbox", { name: "Comments" }),
    ).toBeInTheDocument();
    await expect(selectRow).not.toHaveBeenCalled();
  },
};

/**
 * A row with comments: the button shows them as one line of plain text, cut
 * short to fit the cell, and is named with the whole of it.
 */
export const WithComments: Story = {
  beforeEach: () =>
    seed(
      store,
      1,
      "Translated by **Isabel Burton**. See [the scan](https://archive.org/details/iracema) for the plates.\n\n- Reviewed in *The Athenaeum*\n- Reprinted in 1922",
    ),
  play: async () => {
    await expect(
      screen.getByRole("button", {
        name: "Edit comments: Translated by Isabel Burton. See the scan for the plates. Reviewed in The Athenaeum Reprinted in 1922",
      }),
    ).toBeInTheDocument();
  },
};

/**
 * Editing in the dialog writes the comments to the row as Markdown, and the
 * button shows the new text once the dialog closes.
 */
export const Editing: Story = {
  beforeEach: () => seed(store, 1, null),
  play: async () => {
    await userEvent.click(screen.getByRole("button", { name: "Add comments" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit comments" });

    await userEvent.click(within(dialog).getByRole("textbox"));
    await userEvent.click(within(dialog).getByRole("button", { name: "Bold" }));
    await userEvent.keyboard("First edition");

    await waitFor(() =>
      expect(store.get(publicationFamily(1)).comments).toBe(
        "**First edition**",
      ),
    );

    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Edit comments: First edition" }),
      ).toBeVisible(),
    );
  },
};

/**
 * Comments the server refused, here for being too long: the editor shows the
 * error under the text.
 */
export const TooLong: Story = {
  beforeEach: () =>
    seed(store, 1, "A very long note", {
      comments: "too_long",
    } as PublicationError),
  play: async () => {
    await userEvent.click(
      screen.getByRole("button", { name: "Edit comments: A very long note" }),
    );
    const dialog = await screen.findByRole("dialog", { name: "Edit comments" });

    await expect(
      within(dialog).getByRole("textbox"),
    ).toHaveAccessibleDescription(/This text is too long/);
  },
};
