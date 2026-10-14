import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";

import { ListSkeleton } from "./ListSkeleton";

const meta = {
  title: "Components/List Skeleton",
  component: ListSkeleton,
  args: { rows: 5 },
  parameters: { layout: "padded" },
} satisfies Meta<typeof ListSkeleton>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Five pulsing bars. The play test checks that they sit in a status named
 * "Loading".
 */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const list = within(canvasElement).getByLabelText("Loading");
    await expect(list).toBeInTheDocument();
    await expect(list.querySelectorAll("li")).toHaveLength(5);
  },
};

/** Twelve bars, the last of which fade towards the end. */
export const Many: Story = {
  args: { rows: 12 },
  play: async ({ canvasElement }) => {
    const list = within(canvasElement).getByLabelText("Loading");
    await expect(list.querySelectorAll("li")).toHaveLength(12);
  },
};
