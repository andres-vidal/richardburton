import type { Meta, StoryObj } from "@storybook/react";
import { Publication } from "modules/publication/model";
import { resetAll, setAll } from "modules/publication/store";
import { expect, screen, userEvent, waitFor } from "storybook/test";

import WorkspaceReferencesCell from "./WorkspaceReferencesCell";

const seed = (rowId: number, references: string[]) => {
  resetAll();
  setAll([
    {
      id: rowId,
      publication: {
        ...Publication.empty(),
        title: "Dom Casmurro",
        references,
      },
      errors: null,
    },
  ]);
};

// The trailing "sources" cell for a workspace row. `role="cell"` needs a row/table
// ancestor to be valid ARIA, so the decorator supplies one.
const meta = {
  title: "Publications/Workspace references cell",
  component: WorkspaceReferencesCell,
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
} satisfies Meta<typeof WorkspaceReferencesCell>;

export default meta;

type Story = StoryObj<typeof meta>;

/** With references: the button summarizes the count and opens the list editor. */
export const WithReferences: Story = {
  beforeEach: () => seed(1, ["A source", "Another source"]),
  parameters: {
    // The open modal aria-hides the background trigger, which is still focusable.
    a11y: { config: { rules: [{ id: "aria-hidden-focus", enabled: false }] } },
  },
  play: async () => {
    const button = screen.getByRole("button", { name: "Edit references (2)" });
    await expect(button).toBeInTheDocument();

    await userEvent.click(button);
    // The editor opens in a modal (portalled to the body) seeded with the list.
    await waitFor(() =>
      expect(screen.getByLabelText("Reference 1")).toHaveValue("A source"),
    );
  },
};

/** With none: the button invites adding references. */
export const Empty: Story = {
  beforeEach: () => seed(1, []),
  play: async () => {
    await expect(
      screen.getByRole("button", { name: "Add references" }),
    ).toBeInTheDocument();
  },
};
