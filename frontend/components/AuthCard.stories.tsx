import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, screen, userEvent } from "storybook/test";

import AuthCard from "./AuthCard";
import Button from "./Button";

// The card is named rather than written out, so a story names one of the cards
// the app actually shows.
const meta = {
  title: "Auth/Auth card",
  component: AuthCard,
  args: {
    copy: "auth.errors.Verification",
    children: <Button label="Do the next thing" width="fit" onClick={fn()} />,
  },
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof AuthCard>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A title, what happened, and the one thing to do about it. */
export const Default: Story = {
  play: async () => {
    await expect(
      screen.getByRole("heading", { level: 1, name: "Verification error" }),
    ).toBeVisible();

    const action = screen.getByRole("button", { name: "Do the next thing" });
    await userEvent.click(action);
    await expect(action).toBeVisible();
  },
};

/** A body that suggests a way out says so in a second, quieter line. */
export const WithASuggestion: Story = {
  args: { copy: "auth.errors.AccessDenied" },
  play: async () => {
    await expect(
      screen.getByRole("heading", { name: "You need an invitation" }),
    ).toBeVisible();
    await expect(screen.getByText(/Ask an administrator/)).toBeVisible();
  },
};

/** A body with nothing to suggest is the one line, and nothing quieter under it. */
export const WithoutASuggestion: Story = {
  play: async () => {
    await expect(screen.getByText(/token is expired/)).toBeVisible();
    await expect(screen.queryByText(/Ask an administrator/)).toBeNull();
  },
};

/**
 * The card is not only for sign-in: the 404 is the same shape, since it is also
 * a title, what happened, and the one way on from it.
 */
export const APageThatIsNotThere: Story = {
  args: { copy: "notFound", children: undefined },
  play: async () => {
    await expect(
      screen.getByRole("heading", { level: 1, name: "No such page" }),
    ).toBeVisible();
    await expect(screen.getByText(/link may be out of date/)).toBeVisible();
  },
};

/** Nothing to do next: the foot is empty and the card keeps its shape. */
export const WithoutAnAction: Story = {
  args: { children: undefined },
  play: async () => {
    await expect(
      screen.getByRole("heading", { name: "Verification error" }),
    ).toBeVisible();
    await expect(screen.queryByRole("button")).toBeNull();
  },
};
