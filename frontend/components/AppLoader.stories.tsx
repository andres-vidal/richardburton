import type { Meta, StoryObj } from "@storybook/react";
import { expect, screen } from "storybook/test";

import AppLoader from "./AppLoader";

const meta = {
  title: "Components/App Loader",
  component: AppLoader,
  parameters: {
    layout: "fullscreen",
    docs: { story: { inline: false, height: "22rem" } },
  },
} satisfies Meta<typeof AppLoader>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * The overlay over the page. The play test checks that it is a busy dialog
 * named by its message.
 */
export const Default: Story = {
  play: async () => {
    const dialog = await screen.findByRole("dialog", {
      name: "Your request is being processed",
    });
    await expect(dialog).toHaveAttribute("aria-busy", "true");
  },
};
