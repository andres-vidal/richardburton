import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";

import { ListSkeleton } from "./ListSkeleton";

const meta = {
  title: "Components/List Skeleton",
  component: ListSkeleton,
  tags: ["autodocs"],
  args: { rows: 5 },
  parameters: { layout: "padded" },
} satisfies Meta<typeof ListSkeleton>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A pulsing placeholder list rendered while data loads. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const list = within(canvasElement).getByLabelText("Loading");
    await expect(list).toBeInTheDocument();
    await expect(list.querySelectorAll("li")).toHaveLength(5);
  },
};

/** A longer skeleton, where trailing rows fade out. */
export const Many: Story = {
  args: { rows: 12 },
  play: async ({ canvasElement }) => {
    const list = within(canvasElement).getByLabelText("Loading");
    await expect(list.querySelectorAll("li")).toHaveLength(12);
  },
};
