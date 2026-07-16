import type { Meta, StoryObj } from "@storybook/react";
import { FC, useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";

import NumberInput from "./NumberInput";

// NumberInput is controlled, so hold `value` in state — otherwise typing and the
// ▲/▼ buttons fire onChange but the displayed number never moves.
const Controlled: FC<{
  value?: number;
  error?: string;
  bordered?: boolean;
  min?: number;
  max?: number;
  onChange?: (value: number) => void;
}> = ({ value: initial, error, bordered, min, max, onChange }) => {
  const [value, setValue] = useState(initial);

  return (
    <NumberInput
      aria-label="Year"
      value={value}
      error={error}
      bordered={bordered}
      min={min}
      max={max}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
};

const meta = {
  title: "Components/Number input",
  component: NumberInput,
  tags: ["autodocs"],
  args: { value: undefined, onChange: fn() },
  render: (args) => (
    <Controlled
      value={args.value}
      error={args.error}
      bordered={args.bordered}
      min={args.min as number | undefined}
      max={args.max as number | undefined}
      onChange={args.onChange}
    />
  ),
  parameters: { layout: "centered" },
} satisfies Meta<typeof NumberInput>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Type a digit, then nudge it with the ▲/▼ buttons — the value updates live. */
export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("textbox");

    await userEvent.type(input, "5");
    await expect(input).toHaveValue("5");

    const [up, down] = canvas.getAllByRole("button");

    await userEvent.click(up);
    await expect(input).toHaveValue("6");

    await userEvent.click(down);
    await expect(input).toHaveValue("5");

    await expect(args.onChange).toHaveBeenLastCalledWith(5);
  },
};

/** Bounded by `min`/`max`; incrementing past the max clamps and holds. */
export const Clamped: Story = {
  args: { value: 5, min: 0, max: 5 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const [up] = canvas.getAllByRole("button");

    await userEvent.click(up);
    // Stays at the max instead of rising to 6.
    await expect(canvas.getByRole("textbox")).toHaveValue("5");
  },
};

/** Error state — the field is marked invalid via `aria-invalid`. */
export const WithError: Story = {
  args: { error: "is required" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("textbox")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  },
};

/** `bordered` — the outlined variant (edit form), a visible box with `text-sm`. */
export const Bordered: Story = {
  args: { value: 1953, bordered: true },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole("textbox");
    const box = input.closest("[data-bordered='true']")!;
    await expect(getComputedStyle(box).borderTopWidth).toBe("1px");
  },
};
