import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, within } from "storybook/test";

import TextArrayDataInput from "./TextArrayDataInput";

// A Multicombobox for free-text list cells (authors, originalAuthors,
// publishers). The comma-separated `value` renders as removable pills. Its
// autocomplete calls the network on keystroke, so these stories stay
// render-only — they never type into the field.
const meta = {
  title: "Publications/Text array data input",
  component: TextArrayDataInput,
  args: {
    rowId: 1,
    colId: "authors",
    value: "",
    error: "",
    onChange: fn(),
    "aria-label": "Authors",
  },
  decorators: [
    (Story) => (
      <div className="flex items-center justify-center w-72 aspect-square overflow-auto rounded-lg border border-dashed border-gray-300 p-8 bg-stripes-diagonal">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "centered" },
} satisfies Meta<typeof TextArrayDataInput>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Empty list cell — an autocomplete textbox with no pills yet. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("combobox"),
    ).toBeInTheDocument();
  },
};

/** A populated cell renders one removable pill per comma-separated value. */
export const WithValues: Story = {
  args: { value: "Helen Caldwell,Benjamin Moser" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Helen Caldwell")).toBeInTheDocument();
    await expect(canvas.getByText("Benjamin Moser")).toBeInTheDocument();
  },
};

/** Error state — the cell input is marked invalid via `aria-invalid`. */
export const WithError: Story = {
  args: { error: "is required" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("combobox")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  },
};
