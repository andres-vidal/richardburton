import type { Meta, StoryObj } from "@storybook/react";
import { expect, screen } from "storybook/test";

import SectionHeading from "./SectionHeading";

const meta = {
  title: "Layout/Section heading",
  component: SectionHeading,
  args: { children: "Invitations" },
  parameters: { layout: "centered" },
} satisfies Meta<typeof SectionHeading>;

export default meta;

type Story = StoryObj<typeof meta>;

/** What a section is called, quiet enough to stay out of the content's way. */
export const Default: Story = {
  play: async () => {
    await expect(
      screen.getByRole("heading", { level: 2, name: "Invitations" }),
    ).toBeVisible();
  },
};
