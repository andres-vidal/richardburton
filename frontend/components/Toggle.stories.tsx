import type { Meta, StoryObj } from "@storybook/react";
import { FC, useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";

import Toggle from "./Toggle";

/** Keeps `checked` in state, so a click flips the toggle as a caller would. */
const Controlled: FC<{
  label: string;
  checked?: boolean;
  onClick: () => void;
}> = ({ label, checked: initial = false, onClick }) => {
  const [checked, setChecked] = useState(initial);

  return (
    <Toggle
      label={label}
      width="fit"
      checked={checked}
      onClick={() => {
        setChecked((c) => !c);
        onClick();
      }}
    />
  );
};

const meta = {
  title: "Components/Toggle",
  component: Toggle,
  args: { label: "Row Ids", checked: false, onClick: fn(), width: "fit" },
  render: (args) => (
    <Controlled
      label={args.label}
      checked={args.checked}
      onClick={args.onClick}
    />
  ),
  parameters: { layout: "centered" },
} satisfies Meta<typeof Toggle>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Unchecked, the toggle is outlined, and checked it is filled with a check
 * mark. The play test clicks it on and off and checks `aria-pressed` and the
 * icon each time.
 */
export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    const button = within(canvasElement).getByRole("button", {
      name: "Row Ids",
    });

    await expect(button).toHaveAttribute("aria-pressed", "false");
    await expect(button.querySelector("svg")).toBeNull();

    await userEvent.click(button);
    await expect(args.onClick).toHaveBeenCalledTimes(1);
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await expect(button.querySelector("svg")).not.toBeNull();

    await userEvent.click(button);
    await expect(button).toHaveAttribute("aria-pressed", "false");
    await expect(button.querySelector("svg")).toBeNull();
  },
};

/** Checked: the primary variant with the check mark. */
export const Checked: Story = {
  args: { checked: true },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("button", { name: "Row Ids" }),
    ).toHaveAttribute("aria-pressed", "true");
  },
};
