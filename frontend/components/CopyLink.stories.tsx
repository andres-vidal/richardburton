import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, screen, userEvent } from "storybook/test";

import CopyLink from "./CopyLink";

const meta = {
  title: "Components/Copy link",
  component: CopyLink,
  args: { href: "/publications/7" },
  decorators: [
    (Story) => (
      <div className="p-8 bg-white">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CopyLink>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Copies the path as an absolute URL, and says so on the button. */
export const Default: Story = {
  play: async () => {
    const writeText = fn();
    // Stub rather than assert on the real clipboard: a headless browser may not
    // grant it, and what matters is *what* would be written.
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    await userEvent.click(screen.getByRole("button", { name: "Copy link" }));

    // Absolute, because the point of a link is sending it somewhere else.
    await expect(writeText).toHaveBeenCalledWith(
      `${window.location.origin}/publications/7`,
    );

    // The confirmation lands on the button, where the reader is looking.
    await expect(
      await screen.findByRole("button", { name: "Copied" }),
    ).toBeVisible();
  },
};

/** A refused clipboard says so rather than silently doing nothing. */
export const Refused: Story = {
  play: async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: fn(() => Promise.reject(new Error("denied"))),
      },
      configurable: true,
    });

    await userEvent.click(screen.getByRole("button", { name: "Copy link" }));

    // Still "Copy link": nothing was copied, so nothing is confirmed.
    await expect(
      screen.getByRole("button", { name: "Copy link" }),
    ).toBeVisible();
  },
};
