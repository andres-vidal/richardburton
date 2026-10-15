import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";

import SignInButton from "./SignInButton";

const meta = {
  title: "Components/Sign in button",
  component: SignInButton,
  parameters: { layout: "centered" },
} satisfies Meta<typeof SignInButton>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * The plain offer to sign in with Google. Clicking it leaves the page for
 * Google, so the play test only checks the button's name.
 */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("button", {
        name: "Sign in with Google",
      }),
    ).toBeInTheDocument();
  },
};

/**
 * A `label` that says why the page asks, centred in the button. The play test
 * checks that the label names the button.
 */
export const WithALabel: Story = {
  args: { label: "Try again", centered: true },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("button", { name: "Try again" }),
    ).toHaveAttribute("data-alignment", "center");
  },
};
