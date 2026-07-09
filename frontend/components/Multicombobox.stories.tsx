import type { Meta, StoryObj } from "@storybook/react";
import { FC, useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import Multicombobox from "./Multicombobox";

const OPTIONS = ["Fiction", "Poetry", "Essay", "Drama"];

// Multicombobox is controlled: `value` lives in the parent. This wrapper holds
// it in state so pills actually add/remove as you interact, while still
// forwarding every change to the `onChange` spy for assertions.
const Controlled: FC<{
  value?: string[];
  error?: string;
  getOptions: (search: string) => Promise<string[]> | string[];
  onChange: (value: string[]) => void;
}> = ({ value: initial = [], error, getOptions, onChange }) => {
  const [value, setValue] = useState(initial);

  return (
    <Multicombobox<string>
      value={value}
      error={error}
      placeholder="Add a genre"
      getOptions={getOptions}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
};

const meta = {
  title: "Components/Multicombobox",
  component: Multicombobox,
  tags: ["autodocs"],
  args: {
    value: [],
    onChange: fn(),
    getOptions: fn(async (search: string) =>
      OPTIONS.filter((o) => o.toLowerCase().includes(search)),
    ),
    placeholder: "Add a genre",
  },
  render: (args) => (
    <Controlled
      value={args.value}
      error={args.error}
      getOptions={args.getOptions}
      onChange={args.onChange}
    />
  ),
  parameters: { layout: "centered" },
} satisfies Meta<typeof Multicombobox<string>>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * A single walkthrough of the whole component: type + Enter to add pills, an
 * async lookup on keystroke, and Backspace on an empty input to remove the last
 * pill.
 */
export const Default: Story = {
  // With the dropdown open, floating-ui inserts focus guards (tabindex=0 +
  // aria-hidden) to trap focus — a deliberate pattern axe's aria-hidden-focus
  // rule over-reports, so disable it for this open-menu story.
  parameters: {
    a11y: { config: { rules: [{ id: "aria-hidden-focus", enabled: false }] } },
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("combobox");

    // Starts empty.
    await expect(canvas.queryByText("Fiction")).not.toBeInTheDocument();

    // Type + Enter adds a pill.
    await userEvent.type(input, "Fiction{Enter}");
    await expect(canvas.getByText("Fiction")).toBeInTheDocument();
    await expect(args.onChange).toHaveBeenLastCalledWith(["Fiction"]);

    // ...and another.
    await userEvent.type(input, "Poetry{Enter}");
    await expect(canvas.getByText("Poetry")).toBeInTheDocument();
    await expect(args.onChange).toHaveBeenLastCalledWith(["Fiction", "Poetry"]);

    // Backspace on the (now empty) input removes the last pill.
    await userEvent.type(input, "{Backspace}");
    await expect(canvas.queryByText("Poetry")).not.toBeInTheDocument();
    await expect(canvas.getByText("Fiction")).toBeInTheDocument();
    await expect(args.onChange).toHaveBeenLastCalledWith(["Fiction"]);

    // Typing runs the async option lookup that backs the floating menu.
    await userEvent.type(input, "dr");
    await waitFor(() => expect(args.getOptions).toHaveBeenCalledWith("dr"));
  },
};

/** Error state — the field is marked invalid via `aria-invalid`. */
export const WithError: Story = {
  args: { error: "is required" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("combobox")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  },
};
