import type { Meta, StoryObj } from "@storybook/react";
import { seed } from "modules/publication/fixtures";
import { expect, within } from "storybook/test";

import DataInput from "./DataInput";

// The cell-editor dispatcher: picks the right Text*DataInput by the column's
// attribute type and wires edits back into the publication store.
const meta = {
  title: "Publications/Data input",
  component: DataInput,
  args: { rowId: 1, colId: "title", value: "", error: "", onChange: () => {} },
  parameters: { layout: "centered" },
} satisfies Meta<typeof DataInput>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A text column renders a plain text cell. */
export const Default: Story = {
  beforeEach: () => seed(),
  args: { colId: "title", value: "Dom Casmurro" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("textbox")).toHaveValue(
      "Dom Casmurro",
    );
  },
};

/** A numeric column (year) renders the number cell (a styled text input). */
export const Number: Story = {
  beforeEach: () => seed(),
  args: { colId: "year", value: "1953" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("textbox")).toHaveValue(
      "1953",
    );
  },
};

/** An error marks the cell invalid (`aria-invalid`). */
export const WithError: Story = {
  beforeEach: () => seed(),
  args: { colId: "title", value: "", error: "is required" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("textbox")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  },
};
