import type { Meta, StoryObj } from "@storybook/react";
import { store, type Store } from "modules/store";
import { Publication, type Resemblance } from "modules/publication/model";
import {
  resetAll,
  reviewingAtom,
  setAll,
  setResemblances,
} from "modules/publication/store";
import { expect, fn, screen, userEvent, waitFor } from "storybook/test";

import { LOOK_ALIKE_RECORD } from "test/publication-fixtures";

import WorkspaceSourcesCell from "./WorkspaceSourcesCell";

// A mock of the row's click handler, which selects the row in the workspace.
const selectRow = fn();

// A stored record for the row to resemble.
const STORED = LOOK_ALIKE_RECORD;

const seed = (
  store: Store,
  rowId: number,
  sources: string[],
  resemblance?: Resemblance,
) => {
  resetAll(store);
  selectRow.mockClear();
  setAll(store, [
    {
      id: rowId,
      publication: {
        ...Publication.empty(),
        title: "Dom Casmurro",
        sources,
      },
      errors: null,
    },
  ]);
  setResemblances(
    store,
    [rowId],
    resemblance ? new Map([[rowId, resemblance]]) : new Map(),
  );
};

// The trailing "sources" cell for a workspace row. `role="cell"` needs a row/table
// ancestor to be valid ARIA, so the decorator supplies one. The row has the
// `selectRow` click handler because clicking a real row selects it.
const meta = {
  title: "Publications/Workspace sources cell",
  component: WorkspaceSourcesCell,
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
  parameters: { layout: "centered" },
} satisfies Meta<typeof WorkspaceSourcesCell>;

export default meta;

type Story = StoryObj<typeof meta>;

/** With sources: the button summarizes the count and opens the list editor. */
export const WithSources: Story = {
  beforeEach: () => seed(store, 1, ["A source", "Another source"]),
  parameters: {
    // The open modal aria-hides the background trigger, which is still focusable.
    a11y: { config: { rules: [{ id: "aria-hidden-focus", enabled: false }] } },
  },
  play: async () => {
    const button = screen.getByRole("button", { name: "Edit sources (2)" });
    await expect(button).toBeInTheDocument();

    await userEvent.click(button);
    // The editor opens in a modal (portalled to the body) seeded with the list.
    await waitFor(() =>
      expect(screen.getByLabelText("Source 1")).toHaveValue("A source"),
    );
  },
};

/** With none: the button invites adding sources. */
export const Empty: Story = {
  beforeEach: () => seed(store, 1, []),
  play: async () => {
    await expect(
      screen.getByRole("button", { name: "Add sources" }),
    ).toBeInTheDocument();

    // A row that resembles nothing has no look-alike button.
    await expect(
      screen.queryByRole("button", { name: "Look-alike" }),
    ).not.toBeInTheDocument();
  },
};

/**
 * A row that resembles a stored record. The look-alike button's accessible name
 * gives the record's title and year.
 */
export const LooksLikeAStoredRecord: Story = {
  beforeEach: () =>
    seed(store, 1, ["A source"], { stored: [STORED], others: [] }),
  play: async () => {
    const button = screen.getByRole("button", {
      name: "Resembles Dom Casmurro (1953).",
    });

    await expect(button).toHaveTextContent("Look-alike");
  },
};

/**
 * A row that resembles other rows of the same import. The look-alike button's
 * accessible name gives the number of those rows.
 */
export const LooksLikeOtherRowsOfTheImport: Story = {
  beforeEach: () => seed(store, 1, [], { stored: [], others: [2, 3] }),
  play: async () => {
    await expect(
      screen.getByRole("button", {
        name: "Resembles 2 other rows of this import.",
      }),
    ).toBeInTheDocument();
  },
};

/**
 * Clicking the look-alike button opens the resemblance review on this row. The
 * click does not reach the row, so the row is not selected.
 */
export const OpeningTheReview: Story = {
  beforeEach: () => seed(store, 1, [], { stored: [STORED], others: [] }),
  play: async () => {
    await userEvent.click(
      screen.getByRole("button", { name: "Resembles Dom Casmurro (1953)." }),
    );

    await waitFor(() =>
      expect(store.get(reviewingAtom)).toEqual({ startAt: 1 }),
    );
    await expect(selectRow).not.toHaveBeenCalled();
  },
};
