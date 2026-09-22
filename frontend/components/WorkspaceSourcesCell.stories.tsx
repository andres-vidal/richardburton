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

import WorkspaceSourcesCell from "./WorkspaceSourcesCell";

// Stands in for the row's own click handler, which selects the row.
const selectRow = fn();

// A record already in the database, for a row to look like.
const STORED = {
  ...Publication.empty(),
  id: 7,
  title: "Dom Casmurro",
  authors: ["Helen Caldwell"],
  year: "1953",
};

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
// ancestor to be valid ARIA, so the decorator supplies one, and the row carries a
// click handler because the real one selects the row.
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

    // A row that resembles nothing says nothing.
    await expect(
      screen.queryByRole("button", { name: "Look-alike" }),
    ).not.toBeInTheDocument();
  },
};

/**
 * A row that resembles a record already in the database says so at the end of
 * the row, naming the record rather than only reporting that something matched.
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
 * A row that resembles other rows of the same import counts them, since those
 * rows have no titles to name yet.
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
 * Pressing it opens the review on this row. The row around the cell selects
 * when it is clicked, and asking to see a look-alike is not asking to select,
 * so the click stops there.
 */
export const OpeningTheReview: Story = {
  beforeEach: () => seed(store, 1, [], { stored: [STORED], others: [] }),
  play: async () => {
    await userEvent.click(
      screen.getByRole("button", { name: "Resembles Dom Casmurro (1953)." }),
    );

    await waitFor(() => expect(store.get(reviewingAtom)).toBe(1));
    await expect(selectRow).not.toHaveBeenCalled();
  },
};
