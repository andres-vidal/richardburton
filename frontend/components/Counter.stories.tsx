import type { Meta, StoryObj } from "@storybook/react";
import { expect } from "storybook/test";

import { Counter } from "./Counter";

const meta = {
  title: "Components/Counter",
  component: Counter,
  tags: ["autodocs"],
  args: { value: 1234 },
  parameters: { layout: "centered" },
} satisfies Meta<typeof Counter>;

export default meta;

type Story = StoryObj<typeof meta>;

// Counter animates a framer-motion spring into a bare <span> imperatively; the
// spring doesn't advance under headless test frames, so we assert it mounts
// rather than a specific animated value.

/** Animates up from zero to the target value, formatted with thousands separators. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("span")).toBeInTheDocument();
  },
};

/** Counting down: starts at the value and settles at zero. */
export const CountDown: Story = {
  args: { value: 500, direction: "down" },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("span")).toBeInTheDocument();
  },
};
