import type { Meta, StoryObj } from "@storybook/react";
import { FC, useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";

import NumberInput from "./NumberInput";

/** Keeps `value` in state, so typing and the buttons change the number shown. */
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

/**
 * Typing a number, then stepping it up and down. The play test checks the
 * number after each step and the value passed to `onChange`.
 */
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

/**
 * Bounded by `min` and `max`. The play test steps up from the maximum and
 * checks that the number stays there.
 */
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

/** With an `error`, the field is marked invalid with `aria-invalid`. */
export const WithError: Story = {
  args: { error: "is required" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("textbox")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  },
};

/** `bordered` draws a visible box around the field. */
export const Bordered: Story = {
  args: { value: 1953, bordered: true },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole("textbox");
    const box = input.closest("[data-bordered='true']")!;
    await expect(getComputedStyle(box).borderTopWidth).toBe("1px");
  },
};
