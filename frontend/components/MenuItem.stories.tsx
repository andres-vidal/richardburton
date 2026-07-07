import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "storybook/test";

import MenuItem from "./MenuItem";

const meta = {
  title: "Components/MenuItem",
  component: MenuItem,
  tags: ["autodocs"],
  args: { selected: false, children: "Dom Casmurro", onClick: fn() },
  parameters: { layout: "centered" },
  // Render the option inside a listbox so it is a valid `role="option"` in the
  // a11y tree.
  decorators: [
    (Story) => (
      <ul
        role="listbox"
        aria-label="Options"
        className="w-40 bg-gray-active rounded"
      >
        <Story />
      </ul>
    ),
  ],
} satisfies Meta<typeof MenuItem>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A single option — clicking it fires `onClick`. */
export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const option = canvas.getByRole("option", { name: "Dom Casmurro" });

    await userEvent.click(option);
    await expect(args.onClick).toHaveBeenCalledTimes(1);
  },
};

/** `selected` highlights the item — the active option in a keyboard-navigated menu. */
export const Selected: Story = {
  args: { selected: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const option = canvas.getByRole("option", { name: "Dom Casmurro" });
    await expect(option).toBeInTheDocument();
    await expect(option).toHaveAttribute("aria-selected", "true");
  },
};
