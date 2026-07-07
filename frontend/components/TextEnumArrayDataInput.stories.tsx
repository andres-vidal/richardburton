import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, within } from "storybook/test";

import TextEnumArrayDataInput from "./TextEnumArrayDataInput";

// A Multicombobox for the `countries` cell. The comma-separated `value` holds
// ISO country codes; each renders as a pill labelled by its country name (via
// Publication.describeValue). Country autocomplete resolves locally, but these
// stories stay render-only to avoid depending on the dropdown.
const meta = {
  title: "Publications/Text enum array data input",
  component: TextEnumArrayDataInput,
  args: {
    rowId: 1,
    colId: "countries",
    value: "",
    error: "",
    onChange: fn(),
    "aria-label": "Countries",
  },
  parameters: { layout: "centered" },
} satisfies Meta<typeof TextEnumArrayDataInput>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Empty cell — an autocomplete textbox with no country pills yet. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("combobox"),
    ).toBeInTheDocument();
  },
};

/** A selected country code renders as a pill labelled by its country name. */
export const WithValues: Story = {
  args: { value: "US" },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText("United States of America"),
    ).toBeInTheDocument();
  },
};

/** Error state — the cell input is marked invalid via `aria-invalid`. */
export const WithError: Story = {
  args: { error: "should be a valid country code" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("combobox")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  },
};
