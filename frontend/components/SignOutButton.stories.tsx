import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";

import SignOutButton from "./SignOutButton";

const meta = {
  title: "Components/Sign out button",
  component: SignOutButton,
  tags: ["autodocs"],
  args: {},
  parameters: { layout: "centered" },
} satisfies Meta<typeof SignOutButton>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * The sign-out button. Clicking revokes the `rb-session` via
 * `DELETE /sessions` then reloads the app, so the story only asserts the
 * button renders with its label.
 */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("button", { name: "Sign out" }),
    ).toBeInTheDocument();
  },
};
