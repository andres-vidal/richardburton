import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";

import StrikeHeading from "./StrikeHeading";

const meta = {
  title: "Components/Strike heading",
  component: StrikeHeading,
  tags: ["autodocs"],
  args: { label: "Prepare new publications to be inserted in the database" },
  parameters: { layout: "padded" },
} satisfies Meta<typeof StrikeHeading>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A section heading centered between two rules. */
export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    await expect(within(canvasElement).getByRole("heading")).toHaveTextContent(
      args.label,
    );
  },
};
