import type { Meta, StoryObj } from "@storybook/react";
import { FC, useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import Toggle from "./Toggle";

// Toggle is controlled (`checked` is a prop), so hold it in state — otherwise
// clicking fires onClick but the button never flips variant/icon.
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
  tags: ["autodocs"],
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

/** Click to toggle: unchecked (outline) ⇄ checked (primary, with the check icon). */
export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    const button = within(canvasElement).getByRole("button");

    // Unchecked — no check icon yet.
    await expect(canvasElement.querySelector("svg")).toBeNull();

    await userEvent.click(button);
    await expect(args.onClick).toHaveBeenCalledTimes(1);
    // Checked — the check icon appears.
    await waitFor(() =>
      expect(canvasElement.querySelector("svg")).not.toBeNull(),
    );

    // Toggle back off.
    await userEvent.click(button);
    await waitFor(() => expect(canvasElement.querySelector("svg")).toBeNull());
  },
};

/** The checked state in isolation — filled primary variant with the check icon. */
export const Checked: Story = { args: { checked: true } };
