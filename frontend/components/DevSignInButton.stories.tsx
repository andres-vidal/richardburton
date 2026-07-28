import type { Meta, StoryObj } from "@storybook/react";
import { expect, screen } from "storybook/test";

import DevSignInButton from "./DevSignInButton";

const meta = {
  title: "Auth/Dev sign-in",
  component: DevSignInButton,
  parameters: { layout: "centered" },
} satisfies Meta<typeof DevSignInButton>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * One shortcut per role. What an admin can reach and what a contributor can is
 * the difference worth being able to look at without a Google handshake.
 */
export const Default: Story = {
  play: async () => {
    for (const role of ["Reader", "Contributor", "Administrator"]) {
      await expect(screen.getByRole("button", { name: role })).toBeVisible();
    }
  },
};
