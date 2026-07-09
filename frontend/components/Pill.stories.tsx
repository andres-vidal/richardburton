import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "storybook/test";

import Pill from "./Pill";

const meta = {
  title: "Components/Pill",
  component: Pill,
  tags: ["autodocs"],
  args: { label: "Machado de Assis", onRemove: fn() },
  parameters: { layout: "centered" },
} satisfies Meta<typeof Pill>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A removable tag — a label with a close button that fires `onRemove`. */
export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Machado de Assis")).toBeInTheDocument();

    await userEvent.click(canvas.getByRole("button"));
    await expect(args.onRemove).toHaveBeenCalledTimes(1);
  },
};
