import type { Meta, StoryObj } from "@storybook/react";
import Link from "next/link";
import { expect, screen } from "storybook/test";

import AuthCard from "./AuthCard";
import Button from "./Button";

const meta = {
  title: "Auth/Auth card",
  component: AuthCard,
  args: {
    title: "Sign in",
    children: (
      <p className="text-lg">
        Sign in with your Google account to access the platform.
      </p>
    ),
    action: <Button label="Sign in with Google" width="fit" />,
  },
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof AuthCard>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The title, what happened, and the one thing to do about it. */
export const Default: Story = {
  play: async () => {
    await expect(
      screen.getByRole("heading", { level: 1, name: "Sign in" }),
    ).toBeVisible();
    await expect(
      screen.getByRole("button", { name: "Sign in with Google" }),
    ).toBeVisible();
  },
};

/** Turned away: what happened, why, and the way back. */
export const Refused: Story = {
  args: {
    title: "You need an invitation",
    children: (
      <>
        <p className="text-lg">
          Signing in worked, but this address has not been invited, so there is
          no account for it here.
        </p>
        <p className="text-sm">
          Ask an administrator to invite this address, then sign in again.
        </p>
      </>
    ),
    action: <Button label="Try again" width="fit" />,
  },
  play: async () => {
    await expect(screen.getByText(/has not been invited/)).toBeVisible();
  },
};

/**
 * Admitted, but holding no role that reaches the catalogue. The same card, so
 * it reads as the same place rather than a different app.
 */
export const Pending: Story = {
  args: {
    title: "Your account is ready",
    children: (
      <>
        <p className="text-lg">
          You have an account here, but it does not reach the catalogue yet.
        </p>
        <p className="text-sm">
          An administrator can grant that. Once they do, sign in again and it
          will be waiting for you.
        </p>
      </>
    ),
    action: (
      <Link href="/" className="anchor">
        Browse the catalogue
      </Link>
    ),
  },
  play: async () => {
    await expect(
      screen.getByRole("link", { name: "Browse the catalogue" }),
    ).toBeVisible();
  },
};

/** Nothing to do next: the card holds its shape without an action. */
export const WithoutAnAction: Story = {
  args: {
    title: "Verification error",
    children: (
      <p className="text-lg">
        Seems like your token is expired or has already been used. Please
        contact support.
      </p>
    ),
    action: undefined,
  },
  play: async () => {
    await expect(
      screen.getByRole("heading", { name: "Verification error" }),
    ).toBeVisible();
  },
};
