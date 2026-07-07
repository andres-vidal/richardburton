import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";

import SignInButton from "./SignInButton";

const meta = {
  title: "Components/Sign in button",
  component: SignInButton,
  tags: ["autodocs"],
  args: {},
  parameters: { layout: "centered" },
} satisfies Meta<typeof SignInButton>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * The Google sign-in button. Clicking navigates to `/api/auth/google` (the
 * Arctic handshake), so the story only asserts the button renders with its
 * label.
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

/** With an explicit `next` destination carried through the auth redirect. */
export const WithNext: Story = {
  args: { next: "/publications" },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("button", {
        name: "Sign in with Google",
      }),
    ).toBeInTheDocument();
  },
};
