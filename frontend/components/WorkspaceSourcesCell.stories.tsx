import type { Meta, StoryObj } from "@storybook/react";
import { store, type Store } from "modules/store";
import { Publication } from "modules/publication/model";
import { resetAll, setAll } from "modules/publication/store";
import { expect, screen, userEvent, waitFor } from "storybook/test";

import WorkspaceSourcesCell from "./WorkspaceSourcesCell";

const seed = (store: Store, rowId: number, sources: string[]) => {
  resetAll(store);
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
};

// The trailing "sources" cell for a workspace row. `role="cell"` needs a row/table
// ancestor to be valid ARIA, so the decorator supplies one.
const meta = {
  title: "Publications/Workspace sources cell",
  component: WorkspaceSourcesCell,
  args: { rowId: 1 },
  decorators: [
    (Story) => (
      <div role="table">
        <div role="row">
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
  },
};
