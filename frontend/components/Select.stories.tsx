import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import Select from "./Select";

const OPTIONS = [
  { id: "1", label: "Brazil" },
  { id: "2", label: "Portugal" },
  { id: "3", label: "Angola" },
];

const meta = {
  title: "Components/Select",
  component: Select,
  tags: ["autodocs"],
  args: {
    value: undefined,
    error: "",
    onChange: fn(),
    getOptions: fn(async (search: string) =>
      OPTIONS.filter((o) => o.label.toLowerCase().includes(search)),
    ),
    "aria-label": "Country",
  },
  parameters: { layout: "centered" },
} satisfies Meta<typeof Select>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Combobox input backed by an async `getOptions` lookup. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("combobox"),
    ).toBeInTheDocument();
  },
};

/** A selected option renders its label in the input. */
export const WithValue: Story = {
  args: { value: { id: "1", label: "Brazil" } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("combobox")).toHaveValue(
      "Brazil",
    );
  },
};

/** Typing runs the async option lookup that backs the dropdown. */
export const FilterAndSelect: Story = {
  // With the dropdown open, floating-ui inserts focus guards (tabindex=0 +
  // aria-hidden) to trap focus — a deliberate pattern that axe's
  // aria-hidden-focus rule over-reports, so disable it for this open-menu story.
  parameters: {
    a11y: { config: { rules: [{ id: "aria-hidden-focus", enabled: false }] } },
  },
  play: async ({ args, canvasElement }) => {
    const input = within(canvasElement).getByRole("combobox");
    await userEvent.type(input, "por");

    await waitFor(() => expect(args.getOptions).toHaveBeenCalledWith("por"));
  },
};

/** Error state — the field is marked invalid via `aria-invalid`. */
export const WithError: Story = {
  args: { error: "is required" },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole("combobox");
    await expect(input).toHaveAttribute("aria-invalid", "true");
  },
};
