import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, within } from "storybook/test";

import TextEnumDataInput from "./TextEnumDataInput";

// A single-select Select backed by autocomplete. Driven here with `countries`,
// whose options resolve locally (no network). `value` is one country code and
// shows in the input via its country name (Publication.describeValue).
const meta = {
  title: "Publications/Text enum data input",
  component: TextEnumDataInput,
  args: {
    rowId: 1,
    colId: "countries",
    value: "",
    error: "",
    onChange: fn(),
    "aria-label": "Country",
  },
  parameters: { layout: "centered" },
} satisfies Meta<typeof TextEnumDataInput>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Empty select — a combobox textbox with its dropdown toggle. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("combobox"),
    ).toBeInTheDocument();
  },
};

/** A selected country code shows as its country name in the input. */
export const WithValue: Story = {
  args: { value: "US" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("combobox")).toHaveValue(
      "United States of America",
    );
  },
};

/** Error state — the input is marked invalid via `aria-invalid`. */
export const WithError: Story = {
  args: { error: "is required" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("combobox")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  },
};
